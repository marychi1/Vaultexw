CREATE TABLE IF NOT EXISTS column_wire_authorizations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  counterparty_id TEXT NOT NULL,
  bank_account_id TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, counterparty_id)
);

CREATE INDEX IF NOT EXISTS column_wire_authorizations_enabled_idx
  ON column_wire_authorizations(user_id, enabled);

ALTER TABLE column_wire_transfers ADD COLUMN IF NOT EXISTS split_reference TEXT;
ALTER TABLE column_wire_transfers ADD COLUMN IF NOT EXISTS split_leg TEXT;
ALTER TABLE column_wire_transfers ADD COLUMN IF NOT EXISTS gross_amount_cents BIGINT;

CREATE INDEX IF NOT EXISTS column_wire_transfers_split_reference_idx
  ON column_wire_transfers(split_reference);
