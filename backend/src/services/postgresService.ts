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

        CREATE TABLE IF NOT EXISTS column_webhook_events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          transfer_id TEXT,
          payload JSONB NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
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
          status TEXT NOT NULL CHECK (status IN ('completed', 'pending', 'failed')),
          chain TEXT NOT NULL DEFAULT 'polygon',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS devices_user_id_idx ON devices(user_id);
        CREATE INDEX IF NOT EXISTS notifications_user_id_timestamp_idx ON notifications(user_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS otps_phone_expires_at_idx ON otps(phone, expires_at DESC);
        CREATE TABLE IF NOT EXISTS column_webhook_events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          transfer_id TEXT,
          payload JSONB NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS transactions_user_id_created_at_idx ON transactions(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS column_webhook_events_transfer_id_idx ON column_webhook_events(transfer_id);
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
                ssl: { rejectUnauthorized: false },
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
}

export default PostgresService;
