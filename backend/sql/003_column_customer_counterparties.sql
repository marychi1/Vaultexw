BEGIN;

CREATE TABLE IF NOT EXISTS column_customer_counterparties (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_fingerprint TEXT NOT NULL,
  counterparty_id TEXT UNIQUE,
  display_name TEXT NOT NULL,
  account_last4 CHAR(4) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'UNKNOWN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, request_fingerprint),
  CHECK (
    (status = 'ACTIVE' AND counterparty_id IS NOT NULL)
    OR (status <> 'ACTIVE' AND counterparty_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS column_customer_counterparties_user_created_idx
  ON column_customer_counterparties(user_id, created_at DESC)
  WHERE status = 'ACTIVE';

COMMIT;
