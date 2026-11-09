// Wallet and transaction routes. Balances are derived from the operations ledger
// (sum of deposits minus withdrawals), so a balance can never drift from its history.
// The platform SDK has no transactions: balance-reducing writes use a precheck,
// a conditional write, and a postcheck with compensation. This is not strict
// atomic exclusion; concurrent writers are both fail-closed by the postcheck.
import { AppError, rows } from './http.mjs';
import { isUuid, validateOperation, validateWalletName } from './validate.mjs';

const MAX_OPERATION_ROWS = 10000;
const MAX_WALLETS = 100;
const DEFAULT_WALLET_NAME = 'Main Saving';

async function fetchWallet(db, walletId) {
  const found = rows(await db.from('wallets').select('id,name').eq('id', walletId).limit(1));
  if (found.length !== 1) throw new AppError('wallet_not_found', 404);
  return found[0];
}

async function listOperations(db, walletId) {
  const found = rows(await db.from('operations')
    .select('id,type,amount_cents,note,created_at')
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
    .limit(MAX_OPERATION_ROWS));
  if (found.length >= MAX_OPERATION_ROWS) throw new AppError('wallet_limit_reached', 409);
  return found;
}

function totalsOf(operations) {
  let added = 0;
  let withdrawn = 0;
  for (const op of operations) {
    if (!Number.isSafeInteger(op.amount_cents) || op.amount_cents <= 0) {
      throw new AppError('database_unavailable', 503);
    }
    if (op.type === 'deposit') added += op.amount_cents;
    else if (op.type === 'withdrawal') withdrawn += op.amount_cents;
    else throw new AppError('database_unavailable', 503);
  }
  if (!Number.isSafeInteger(added) || !Number.isSafeInteger(withdrawn)) {
    throw new AppError('wallet_limit_reached', 409);
  }
  return { added, withdrawn, balance: added - withdrawn };
}

function operationEffect(type, amountCents) {
  return type === 'deposit' ? amountCents : -amountCents;
}

async function walletPayload(db, walletId) {
  const wallet = await fetchWallet(db, walletId);
  const operations = await listOperations(db, walletId);
  const totals = totalsOf(operations);
  return {
    wallet: { id: wallet.id, name: wallet.name },
    balanceCents: totals.balance,
    totalAddedCents: totals.added,
    totalWithdrawnCents: totals.withdrawn,
    operations: operations.map((op) => ({
      id: op.id,
      type: op.type,
      amountCents: op.amount_cents,
      note: op.note,
      date: op.created_at,
    })),
  };
}

export async function listWallets(db) {
  let wallets = rows(await db.from('wallets').select('id,name,created_at').order('created_at').limit(MAX_WALLETS));
  if (wallets.length === 0) {
    // First run: create the default wallet. insertIfAbsent makes a concurrent
    // first read resolve to the same single wallet.
    rows(await db.from('wallets').insertIfAbsent({
      id: crypto.randomUUID(), name: DEFAULT_WALLET_NAME, created_at: new Date().toISOString(),
    }, { onConflict: 'name' }).select('id'));
    wallets = rows(await db.from('wallets').select('id,name,created_at').order('created_at').limit(MAX_WALLETS));
    if (wallets.length === 0) throw new AppError('database_unavailable', 503);
  }
  const operations = rows(await db.from('operations').select('wallet_id,type,amount_cents').limit(MAX_OPERATION_ROWS));
  if (operations.length >= MAX_OPERATION_ROWS) throw new AppError('wallet_limit_reached', 409);
  const balances = new Map();
  for (const op of operations) {
    if (!Number.isSafeInteger(op.amount_cents)) throw new AppError('database_unavailable', 503);
    const effect = op.type === 'deposit' ? op.amount_cents : op.type === 'withdrawal' ? -op.amount_cents : null;
    if (effect === null) throw new AppError('database_unavailable', 503);
    balances.set(op.wallet_id, (balances.get(op.wallet_id) ?? 0) + effect);
  }
  return wallets.map((wallet) => ({
    id: wallet.id,
    name: wallet.name,
    balanceCents: balances.get(wallet.id) ?? 0,
  }));
}

export async function createWallet(db, body) {
  const name = validateWalletName(body?.name);
  const id = crypto.randomUUID();
  const created = rows(await db.from('wallets').insertIfAbsent({
    id, name, created_at: new Date().toISOString(),
  }, { onConflict: 'name' }).select('id,name'));
  if (created.length !== 1) throw new AppError('wallet_name_taken', 409);
  return { wallet: { id, name, balanceCents: 0 }, wallets: await listWallets(db) };
}

export async function renameWallet(db, walletId, body) {
  const name = validateWalletName(body?.name);
  await fetchWallet(db, walletId);
  const existing = rows(await db.from('wallets').select('id').eq('name', name).limit(1));
  if (existing.length === 1 && existing[0].id !== walletId) throw new AppError('wallet_name_taken', 409);
  const updated = rows(await db.from('wallets').update({ name }).eq('id', walletId).select('id'));
  if (updated.length !== 1) throw new AppError('write_conflict', 409);
  const wallets = await listWallets(db);
  return { wallet: wallets.find((wallet) => wallet.id === walletId), wallets };
}

export async function deleteWallet(db, walletId) {
  await fetchWallet(db, walletId);
  const remaining = rows(await db.from('wallets').select('id').limit(2));
  if (remaining.length <= 1) throw new AppError('last_wallet', 409);
  // Two writes, not one transaction: if the wallet delete fails after its
  // operations were removed, the wallet remains with a zero balance and the
  // delete can be retried safely.
  rows(await db.from('operations').delete().eq('wallet_id', walletId).select('id'));
  const deleted = rows(await db.from('wallets').delete().eq('id', walletId).select('id'));
  if (deleted.length !== 1) throw new AppError('write_conflict', 409);
  return { wallets: await listWallets(db) };
}

export async function getWallet(db, walletId) {
  return walletPayload(db, walletId);
}

export async function createOperation(db, walletId, body) {
  const { type, amountCents, note } = validateOperation(body);
  await fetchWallet(db, walletId);
  if (type === 'withdrawal') {
    const totals = totalsOf(await listOperations(db, walletId));
    if (amountCents > totals.balance) throw new AppError('insufficient_funds', 409);
  }
  const id = crypto.randomUUID();
  const inserted = rows(await db.from('operations').insertIfAbsent({
    id, wallet_id: walletId, type, amount_cents: amountCents, note, created_at: new Date().toISOString(),
  }, { onConflict: 'id' }).select('id'));
  if (inserted.length !== 1) throw new AppError('mutation_unconfirmed', 503);
  if (type === 'withdrawal') {
    const after = totalsOf(await listOperations(db, walletId));
    if (after.balance < 0) {
      // A concurrent withdrawal won the race; remove only the row just created.
      const removed = rows(await db.from('operations').delete().eq('id', id).eq('wallet_id', walletId).select('id'));
      if (removed.length !== 1) throw new AppError('mutation_unconfirmed', 503);
      throw new AppError('insufficient_funds', 409);
    }
  }
  return walletPayload(db, walletId);
}

export async function updateOperation(db, walletId, body) {
  const operationId = body?.operationId;
  if (!isUuid(operationId)) throw new AppError('invalid_input', 422);
  const { type, amountCents, note } = validateOperation(body);
  await fetchWallet(db, walletId);
  const found = rows(await db.from('operations').select('id,type,amount_cents,note')
    .eq('id', operationId).eq('wallet_id', walletId).limit(1));
  if (found.length !== 1) throw new AppError('operation_not_found', 404);
  const current = found[0];
  const totals = totalsOf(await listOperations(db, walletId));
  const newBalance = totals.balance
    - operationEffect(current.type, current.amount_cents)
    + operationEffect(type, amountCents);
  if (newBalance < 0) throw new AppError('balance_negative', 409);
  // The observed row values are predicates of the write: a concurrent edit
  // makes this update a confirmed no-op instead of a lost update.
  const updated = rows(await db.from('operations')
    .update({ type, amount_cents: amountCents, note })
    .eq('id', operationId).eq('wallet_id', walletId)
    .eq('type', current.type).eq('amount_cents', current.amount_cents).eq('note', current.note)
    .select('id'));
  if (updated.length !== 1) throw new AppError('write_conflict', 409);
  const after = totalsOf(await listOperations(db, walletId));
  if (after.balance < 0) {
    const reverted = rows(await db.from('operations')
      .update({ type: current.type, amount_cents: current.amount_cents, note: current.note })
      .eq('id', operationId).eq('wallet_id', walletId)
      .eq('type', type).eq('amount_cents', amountCents).eq('note', note)
      .select('id'));
    if (reverted.length !== 1) throw new AppError('mutation_unconfirmed', 503);
    throw new AppError('balance_negative', 409);
  }
  return walletPayload(db, walletId);
}

export async function deleteOperation(db, walletId, operationId) {
  if (!isUuid(operationId)) throw new AppError('invalid_input', 422);
  await fetchWallet(db, walletId);
  const found = rows(await db.from('operations').select('id,type,amount_cents,note,created_at')
    .eq('id', operationId).eq('wallet_id', walletId).limit(1));
  if (found.length !== 1) throw new AppError('operation_not_found', 404);
  const current = found[0];
  const totals = totalsOf(await listOperations(db, walletId));
  if (totals.balance - operationEffect(current.type, current.amount_cents) < 0) {
    throw new AppError('delete_negative', 409);
  }
  const deleted = rows(await db.from('operations').delete()
    .eq('id', operationId).eq('wallet_id', walletId).select('id'));
  if (deleted.length !== 1) throw new AppError('write_conflict', 409);
  const after = totalsOf(await listOperations(db, walletId));
  if (after.balance < 0) {
    const restored = rows(await db.from('operations').insertIfAbsent({
      id: current.id, wallet_id: walletId, type: current.type,
      amount_cents: current.amount_cents, note: current.note, created_at: current.created_at,
    }, { onConflict: 'id' }).select('id'));
    if (restored.length !== 1) throw new AppError('mutation_unconfirmed', 503);
    throw new AppError('delete_negative', 409);
  }
  return walletPayload(db, walletId);
}

export async function clearOperations(db, walletId) {
  await fetchWallet(db, walletId);
  rows(await db.from('operations').delete().eq('wallet_id', walletId).select('id'));
  return walletPayload(db, walletId);
}