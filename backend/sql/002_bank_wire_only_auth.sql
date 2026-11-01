-- Keep existing wallet data intact, but allow bank-wire accounts without wallets.
ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;
ALTER TABLE users ALTER COLUMN encrypted_private_key DROP NOT NULL;
