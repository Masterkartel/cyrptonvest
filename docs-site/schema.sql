-- Users & auth
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Wallet + transactions
CREATE TABLE IF NOT EXISTS wallets (
  user_id TEXT PRIMARY KEY,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  btc_addr TEXT,
  trc20_addr TEXT,
  eth_addr TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,          -- 'deposit' | 'withdraw' | 'plan_charge' | 'adjustment'
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  ref TEXT,                    -- TXID or internal ref
  status TEXT NOT NULL,        -- 'pending' | 'completed' | 'failed'
  meta TEXT,                   -- JSON (network, address, notes)
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Plans
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_deposit_cents INTEGER NOT NULL,
  terms TEXT
);

INSERT OR IGNORE INTO plans (id, name, min_deposit_cents, terms) VALUES
  ('starter','Starter',        10000,  'Entry plan'),
  ('growth','Growth',         100000,  'Balanced exposure'),
  ('pro',   'Professional',  1000000,  'Custom mandate');

CREATE TABLE IF NOT EXISTS user_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  status TEXT NOT NULL,        -- 'active'|'paused'|'cancelled'
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(plan_id) REFERENCES plans(id)
);
