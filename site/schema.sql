-- FinStats hosted schema. Balances are derived from the operations ledger,
-- so wallets intentionally has no balance column. No DML: the application
-- creates the first account and default wallet at runtime.
-- function_backend: accessPolicies are platform-managed (pass []).

CREATE TABLE app.users (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  password_iterations integer NOT NULL,
  created_at timestamptz NOT NULL
);

-- Only token digests are stored; plaintext session tokens never touch the database.
CREATE TABLE app.sessions (
  token_digest text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app.users (id),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE app.auth_limiter (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL
);

CREATE TABLE app.wallets (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL
);

CREATE TABLE app.operations (
  id uuid PRIMARY KEY,
  wallet_id uuid NOT NULL REFERENCES app.wallets (id),
  type text NOT NULL,
  amount_cents bigint NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX operations_wallet_idx ON app.operations (wallet_id, created_at);