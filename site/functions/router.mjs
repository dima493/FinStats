// Application routes: single-account auth (setup/login/logout/status) plus
// wallet and transaction APIs. Identity comes only from this application's own
// session validation; platform identity and browser-supplied owner fields are
// never used. Any valid session is the account owner (single-account app).
import { AppError, applicationPath, errorJson, json, readJson, requireTrustedOrigin, rows } from './http.mjs';
import { canonicalUsername, isUuid, validatePassword } from './validate.mjs';
import { hashPassword, verifyPassword, verifyPasswordAgainstDummy } from './passwords.mjs';
import { SESSION_TTL_MS, clearSessionCookie, createSession, revokeSession, sessionCookie, validateSession } from './sessions.mjs';
import { consume } from './limiter.mjs';
import {
  clearOperations, createOperation, createWallet, deleteOperation, deleteWallet,
  getWallet, listWallets, renameWallet, updateOperation,
} from './wallets.mjs';

const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
const encoder = new TextEncoder();

class SessionRequired extends Error {
  constructor(state) {
    super('login_required');
    this.state = state;
  }
}

const retryAfter = (result) => ({ 'retry-after': String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))) });

function unauthorized(state) {
  return state === 'invalid'
    ? errorJson('login_required', 401, { 'set-cookie': clearSessionCookie() })
    : errorJson('login_required', 401);
}

async function requireSession(db, request) {
  const result = await validateSession(db, request);
  if (result.state !== 'valid') throw new SessionRequired(result.state);
  return result.session;
}

async function loadUser(db, userId) {
  const found = rows(await db.from('users').select('id,username').eq('id', userId).limit(1));
  if (found.length !== 1 || typeof found[0]?.username !== 'string') {
    throw new SessionRequired('invalid');
  }
  return { id: found[0].id, username: found[0].username };
}

function boundedPassword(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || encoder.encode(raw).length > 256) {
    throw new AppError('invalid_input', 400);
  }
  return raw;
}

async function authStatus(db, request) {
  const result = await validateSession(db, request);
  const anyUser = rows(await db.from('users').select('id').limit(1));
  const needsSetup = anyUser.length === 0;
  if (result.state === 'valid') {
    const user = await loadUser(db, result.session.userId);
    return json({ authenticated: true, needsSetup: false, username: user.username });
  }
  const extra = result.state === 'invalid' ? { 'set-cookie': clearSessionCookie() } : {};
  return json({ authenticated: false, needsSetup }, 200, extra);
}

async function setup(db, body) {
  const anyUser = rows(await db.from('users').select('id').limit(1));
  if (anyUser.length > 0) return errorJson('setup_closed', 409);
  const username = canonicalUsername(body?.username);
  const password = validatePassword(body?.password);
  const limit = await consume(db, 'register', username);
  if (!limit.allowed) return errorJson('rate_limited', 429, retryAfter(limit));

  const derived = await hashPassword(password);
  const id = crypto.randomUUID();
  const created = rows(await db.from('users').insertIfAbsent({
    id,
    username,
    password_salt: derived.salt,
    password_hash: derived.hash,
    password_iterations: derived.iterations,
    created_at: new Date().toISOString(),
  }, { onConflict: 'username' }).select('id,username'));
  if (created.length !== 1) return errorJson('username_taken', 409);

  // Single-account invariant: two concurrent setups with different usernames
  // could both pass the empty check; the loser removes its own row.
  const allUsers = rows(await db.from('users').select('id').limit(2));
  if (allUsers.length > 1) {
    rows(await db.from('users').delete().eq('id', id).select('id'));
    return errorJson('setup_closed', 409);
  }

  const { token } = await createSession(db, id);
  return json({ authenticated: true, username }, 201, { 'set-cookie': sessionCookie(token, SESSION_TTL_SECONDS) });
}

async function login(db, body) {
  const username = canonicalUsername(body?.username);
  const limit = await consume(db, 'login', username);
  if (!limit.allowed) return errorJson('rate_limited', 429, retryAfter(limit));

  const password = boundedPassword(body?.password);
  const found = rows(await db.from('users')
    .select('id,username,password_salt,password_hash,password_iterations').eq('username', username).limit(1));

  if (found.length !== 1) {
    await verifyPasswordAgainstDummy(password);
    return errorJson('invalid_credentials', 401);
  }

  const user = found[0];
  const ok = await verifyPassword(password, {
    salt: user.password_salt, hash: user.password_hash, iterations: user.password_iterations,
  });
  if (!ok) return errorJson('invalid_credentials', 401);

  const { token } = await createSession(db, user.id);
  return json({ authenticated: true, username: user.username }, 200, { 'set-cookie': sessionCookie(token, SESSION_TTL_SECONDS) });
}

async function logout(db, request) {
  const result = await validateSession(db, request);
  if (result.state === 'valid' && result.session) {
    try {
      await revokeSession(db, result.session.digest);
    } catch {
      // Unknown revocation outcome: keep the cookie so the user can retry.
      return errorJson('logout_unconfirmed', 503);
    }
  }
  return json({ authenticated: false }, 200, { 'set-cookie': clearSessionCookie() });
}

function queryId(request, name) {
  const value = new URL(request.url).searchParams.get(name);
  if (!isUuid(value)) throw new AppError('invalid_input', 422);
  return value;
}

async function route(db, request, origin) {
  requireTrustedOrigin(request, origin);
  const path = applicationPath(request);

  if (path === '/api/health' && request.method === 'GET') return json({ ok: true });

  if (path === '/api/auth') {
    if (request.method === 'GET') return authStatus(db, request);
    if (request.method === 'POST') {
      const body = await readJson(request);
      if (body?.action === 'setup') return setup(db, body);
      if (body?.action === 'login') return login(db, body);
      if (body?.action === 'logout') return logout(db, request);
      throw new AppError('invalid_input', 400);
    }
    throw new AppError('method_not_allowed', 405);
  }

  if (path === '/api/wallets') {
    await requireSession(db, request);
    if (request.method === 'GET') return json({ wallets: await listWallets(db) });
    if (request.method === 'POST') return json(await createWallet(db, await readJson(request)), 201);
    if (request.method === 'PATCH') return json(await renameWallet(db, queryId(request, 'id'), await readJson(request)));
    if (request.method === 'DELETE') return json(await deleteWallet(db, queryId(request, 'id')));
    throw new AppError('method_not_allowed', 405);
  }

  if (path === '/api/wallet') {
    await requireSession(db, request);
    const walletId = queryId(request, 'walletId');
    if (request.method === 'GET') return json(await getWallet(db, walletId));
    if (request.method === 'POST') return json(await createOperation(db, walletId, await readJson(request)), 201);
    if (request.method === 'PATCH') return json(await updateOperation(db, walletId, await readJson(request)));
    if (request.method === 'DELETE') {
      const operationId = new URL(request.url).searchParams.get('operationId');
      if (operationId !== null) return json(await deleteOperation(db, walletId, operationId));
      return json(await clearOperations(db, walletId));
    }
    throw new AppError('method_not_allowed', 405);
  }

  throw new AppError('not_found', 404);
}

// Dependency injection is only for local tests; ctx provides the request alone.
export function createApplication({ db, origin }) {
  return async function handle(ctx) {
    try {
      return await route(db, ctx.request, typeof origin === 'function' ? origin() : origin);
    } catch (error) {
      if (error instanceof SessionRequired) return unauthorized(error.state);
      if (error instanceof AppError) return errorJson(error.code, error.status);
      return errorJson('service_unavailable', 503);
    }
  };
}