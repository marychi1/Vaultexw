import { Pool } from 'pg';
import { getBackendConfig } from '../config';

class PostgresService {
    private static pool: Pool | null = null;
    private static schemaPromise: Promise<boolean> | null = null;

    static async ensureSchema(): Promise<boolean> {
        if (this.schemaPromise) return this.schemaPromise;

        this.schemaPromise = this.createSchema();
        return this.schemaPromise;
    }

    private static async createSchema(): Promise<boolean> {
        const pool = this.getPool();
        if (!pool) return false;

        try {
            await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          phone TEXT UNIQUE NOT NULL,
          pin_hash TEXT NOT NULL,
          wallet_address TEXT NOT NULL UNIQUE,
          encrypted_private_key TEXT NOT NULL,
          verified BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          balance NUMERIC(30, 6) NOT NULL DEFAULT 0,
          last_login TIMESTAMPTZ,
          pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
          pin_locked_until TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS devices (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          device_id TEXT NOT NULL,
          device_name TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          user_agent TEXT NOT NULL,
          authorized BOOLEAN NOT NULL DEFAULT TRUE,
          last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, device_id)
        );

        CREATE TABLE IF NOT EXISTS otps (
          id TEXT PRIMARY KEY,
          phone TEXT NOT NULL,
          code TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          device_id TEXT NOT NULL,
          device_name TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          read BOOLEAN NOT NULL DEFAULT FALSE
        );

        CREATE TABLE IF NOT EXISTS webauthn_challenges (
          phone TEXT PRIMARY KEY,
          challenge TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS credentials (
          phone TEXT NOT NULL,
          credential_id TEXT NOT NULL,
          public_key TEXT NOT NULL,
          counter INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (phone, credential_id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('deposit', 'transfer', 'withdrawal')),
          amount NUMERIC(30, 6) NOT NULL CHECK (amount >= 0),
          tx_hash TEXT,
          recipient_address TEXT,
          status TEXT NOT NULL CHECK (status IN ('completed', 'pending', 'failed')),
          chain TEXT NOT NULL DEFAULT 'polygon',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS column_webhook_events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          transfer_id TEXT,
          payload JSONB NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS column_wire_transfers (
          idempotency_key TEXT PRIMARY KEY,
          reference TEXT NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          transfer_id TEXT UNIQUE,
          amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
          currency_code TEXT NOT NULL CHECK (currency_code = 'USD'),
          recipient_name TEXT NOT NULL,
          bank_account_id TEXT NOT NULL,
          counterparty_id TEXT NOT NULL,
          description TEXT,
          split_reference TEXT,
          split_leg TEXT CHECK (split_leg IS NULL OR split_leg IN ('reserve', 'recipient')),
          gross_amount_cents BIGINT CHECK (gross_amount_cents IS NULL OR gross_amount_cents > 0),
          status TEXT NOT NULL,
          last_error_code TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_reconciled_at TIMESTAMPTZ
        );

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

        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recipient_address TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS users_supabase_user_id_idx
          ON users(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
        ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;
        ALTER TABLE users ALTER COLUMN encrypted_private_key DROP NOT NULL;
        ALTER TABLE column_wire_transfers ADD COLUMN IF NOT EXISTS reference TEXT;
        ALTER TABLE column_wire_transfers ADD COLUMN IF NOT EXISTS recipient_name TEXT;
        ALTER TABLE column_wire_transfers ADD COLUMN IF NOT EXISTS split_reference TEXT;
        ALTER TABLE column_wire_transfers ADD COLUMN IF NOT EXISTS split_leg TEXT;
        ALTER TABLE column_wire_transfers ADD COLUMN IF NOT EXISTS gross_amount_cents BIGINT;
        UPDATE column_wire_transfers
          SET reference = 'VTX-' || UPPER(SUBSTRING(MD5(random()::text || clock_timestamp()::text) FROM 1 FOR 16))
          WHERE reference IS NULL;
        UPDATE column_wire_transfers SET recipient_name = 'Recipient' WHERE recipient_name IS NULL;
        ALTER TABLE column_wire_transfers ALTER COLUMN reference SET NOT NULL;
        ALTER TABLE column_wire_transfers ALTER COLUMN recipient_name SET NOT NULL;

        DO $
        BEGIN
          IF EXISTS (
            SELECT 1 FROM devices
            GROUP BY device_id
            HAVING COUNT(*) > 1
          ) THEN
            RAISE EXCEPTION 'Duplicate device_id values exist; reconcile device ownership before applying global uniqueness';
          END IF;
        END $;
        CREATE UNIQUE INDEX IF NOT EXISTS devices_device_id_unique_idx ON devices(device_id);
        CREATE INDEX IF NOT EXISTS devices_user_id_idx ON devices(user_id);
        CREATE INDEX IF NOT EXISTS notifications_user_id_timestamp_idx ON notifications(user_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS otps_phone_expires_at_idx ON otps(phone, expires_at DESC);
        CREATE INDEX IF NOT EXISTS transactions_user_id_created_at_idx ON transactions(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS column_webhook_events_transfer_id_idx ON column_webhook_events(transfer_id);
        CREATE INDEX IF NOT EXISTS column_wire_transfers_user_created_idx ON column_wire_transfers(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS column_wire_transfers_status_idx ON column_wire_transfers(status);
        CREATE UNIQUE INDEX IF NOT EXISTS column_wire_transfers_reference_idx ON column_wire_transfers(reference);
        CREATE INDEX IF NOT EXISTS column_wire_transfers_split_reference_idx
          ON column_wire_transfers(split_reference);
        CREATE INDEX IF NOT EXISTS column_wire_authorizations_enabled_idx
          ON column_wire_authorizations(user_id, enabled);
      `);

            return true;
        } catch (error) {
            console.error('[Postgres] Schema initialization failed:', error);
            this.schemaPromise = null;
            return false;
        }
    }

    static getPool(): Pool | null {
        const { postgresEnabled, databaseUrl } = getBackendConfig();
        if (!postgresEnabled || !databaseUrl) {
            return null;
        }

        if (!this.pool) {
            this.pool = new Pool({
                connectionString: databaseUrl,
                ssl: { rejectUnauthorized: true },
            });
        }

        return this.pool;
    }

    static async ping(): Promise<boolean> {
        const pool = this.getPool();
        if (!pool) return false;

        try {
            const result = await pool.query('SELECT 1');
            return result.rows.length === 1;
        } catch {
            return false;
        }
    }

    static async checkReady(): Promise<boolean> {
        if (!(await this.ensureSchema())) return false;
        const pool = this.getPool();
        if (!pool) return false;

        try {
            const result = await pool.query(`
                SELECT
                    to_regclass('public.column_webhook_events') IS NOT NULL AS webhook_events_ready,
                    to_regclass('public.column_wire_transfers') IS NOT NULL AS wire_transfers_ready,
                    to_regclass('public.column_wire_authorizations') IS NOT NULL AS wire_authorizations_ready
            `);
            return result.rows[0]?.webhook_events_ready === true &&
                result.rows[0]?.wire_transfers_ready === true &&
                result.rows[0]?.wire_authorizations_ready === true;
        } catch (error) {
            console.error('[Postgres] Readiness check failed:', error);
            return false;
        }
    }
}

export default PostgresService;
