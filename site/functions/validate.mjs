import { AppError } from './http.mjs';

export const USERNAME_MIN_CHARS = 3;
export const USERNAME_MAX_CHARS = 32;
export const PASSWORD_MIN_CHARS = 8;
export const PASSWORD_MAX_BYTES = 256;
export const WALLET_NAME_MAX_CHARS = 60;
export const NOTE_MAX_CHARS = 80;

export function canonicalUsername(raw) {
  if (typeof raw !== 'string') throw new AppError('invalid_username', 400);
  const canonical = raw.trim().toLowerCase();
  if (canonical.length < USERNAME_MIN_CHARS || canonical.length > USERNAME_MAX_CHARS) {
    throw new AppError('invalid_username', 400);
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(canonical)) throw new AppError('invalid_username', 400);
  return canonical;
}

export function validatePassword(raw) {
  if (typeof raw !== 'string') throw new AppError('invalid_password', 400);
  if ([...raw].length < PASSWORD_MIN_CHARS) throw new AppError('invalid_password', 400);
  if (new TextEncoder().encode(raw).length > PASSWORD_MAX_BYTES) throw new AppError('invalid_password', 400);
  return raw;
}

export function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

export function validateWalletName(raw) {
  if (typeof raw !== 'string') throw new AppError('invalid_input', 422);
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name || [...name].length > WALLET_NAME_MAX_CHARS) throw new AppError('invalid_input', 422);
  return name;
}

export function validateOperation(body) {
  const type = body?.type;
  if (type !== 'deposit' && type !== 'withdrawal') throw new AppError('invalid_input', 422);
  const amountCents = body?.amountCents;
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new AppError('invalid_input', 422);
  const rawNote = body?.note ?? '';
  if (typeof rawNote !== 'string') throw new AppError('invalid_input', 422);
  const note = rawNote.trim();
  if ([...note].length > NOTE_MAX_CHARS) throw new AppError('invalid_input', 422);
  return { type, amountCents, note };
}