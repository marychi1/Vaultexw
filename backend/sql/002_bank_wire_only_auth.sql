-- Keep existing wallet data intact, but allow bank-wire accounts without wallets.
ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;
ALTER TABLE users ALTER COLUMN encrypted_private_key DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_supabase_user_id_idx
  ON users(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
