-- bank
CREATE TABLE bank (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

-- loan
CREATE TABLE loan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  bank_id INTEGER DEFAULT NULL,
  principal_cents BIGINT NOT NULL DEFAULT 0,
  interest_rate_bps INTEGER NOT NULL DEFAULT 0,
  start_time BIGINT NOT NULL DEFAULT 0,
  next_repayment_time BIGINT NOT NULL DEFAULT 0,
  repaid_principal_cents BIGINT NOT NULL DEFAULT 0,
  repaid_interest_cents BIGINT NOT NULL DEFAULT 0,
  repaid_amount_cents BIGINT NOT NULL DEFAULT 0,
  remaining_principal_cents BIGINT NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  repayment_periods INTEGER NOT NULL DEFAULT 0,
  repayment_method INTEGER NOT NULL DEFAULT 0
);

-- repayment
CREATE TABLE repayment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  loan_id INTEGER NOT NULL,
  repayment_time BIGINT NOT NULL,
  principal_cents BIGINT NOT NULL DEFAULT 0,
  interest_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL DEFAULT 0,
  remaining_principal_cents BIGINT NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT ''
);
