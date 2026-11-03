import { getBackendConfig, getProductionConfigErrors } from '../src/config';

describe('backend config', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    test('uses environment overrides in production and enables Neon/Postgres when configured', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.COLUMN_LIVE_WIRES_ENABLED;
        delete process.env.CORS_ORIGIN;
        process.env.JWT_SECRET = 'prod-secret';
        process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
        process.env.SUPABASE_URL = 'https://project.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'anon-key';
        process.env.DATABASE_DRIVER = 'postgres';
        process.env.DATABASE_URL = 'postgres://user:pass@host/db';
        process.env.OTP_PROVIDER = 'twilio';

        const config = getBackendConfig();

        expect(config.jwtSecret).toBe('prod-secret');
        expect(config.encryptionKey).toBe('12345678901234567890123456789012');
        expect(config.supabaseUrl).toBe('https://project.supabase.co');
        expect(config.supabaseEnabled).toBe(true);
        expect(config.databaseDriver).toBe('postgres');
        expect(config.databaseUrl).toBe('postgres://user:pass@host/db');
        expect(config.postgresEnabled).toBe(true);
        expect(config.corsOrigins).toEqual([
            'https://vaultexwallet.io',
            'https://www.vaultexwallet.io',
        ]);
        expect(config.otpProvider).toBe('twilio');
        expect(config.columnBaseUrl).toBe('https://api.column.com');
        expect(config.columnEnabled).toBe(false);
    });

    test('preserves configured production CORS origins and includes both Vaultex hosts', () => {
        process.env.NODE_ENV = 'production';
        process.env.CORS_ORIGIN = 'https://preview.example.com, https://vaultexwallet.io';

        const config = getBackendConfig();

        expect(config.corsOrigins).toEqual([
            'https://preview.example.com',
            'https://vaultexwallet.io',
            'https://www.vaultexwallet.io',
        ]);
    });

    test('falls back to safe development defaults when values are missing', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.COLUMN_LIVE_WIRES_ENABLED;
        delete process.env.JWT_SECRET;
        delete process.env.ENCRYPTION_KEY;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_ANON_KEY;
        delete process.env.DATABASE_DRIVER;
        delete process.env.DATABASE_URL;

        const config = getBackendConfig();

        expect(config.jwtSecret).toMatch(/dev|local/i);
        expect(config.encryptionKey.length).toBeGreaterThanOrEqual(32);
        expect(config.supabaseEnabled).toBe(false);
        expect(config.databaseDriver).toBe('file');
        expect(config.postgresEnabled).toBe(false);
        expect(config.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']);
        expect(config.otpProvider).toBe('console');
        expect(getProductionConfigErrors(config)).toEqual([]);
    });

    test('keeps live Column wires disabled until ownership controls are implemented', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'a'.repeat(64);
        process.env.ENCRYPTION_KEY = 'b'.repeat(64);
        process.env.CORS_ORIGIN = 'https://example.com';
        process.env.COLUMN_LIVE_WIRES_ENABLED = 'true';
        process.env.COLUMN_ENABLED = 'true';
        process.env.COLUMN_API_KEY = 'column-api-key';
        process.env.COLUMN_WEBHOOK_SECRET = 'column-webhook-secret';
        process.env.COLUMN_WEBHOOK_ENDPOINT_ID = 'endpoint-id';
        process.env.DATABASE_DRIVER = 'postgres';
        process.env.DATABASE_URL = 'postgres://host/db';

        const config = getBackendConfig();

        expect(config.columnEnabled).toBe(true);
        expect(config.columnLiveWiresEnabled).toBe(false);
        expect(getProductionConfigErrors(config)).toEqual([]);
    });

    test('does not require Twilio in production when console OTP is used', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.JWT_SECRET;
        delete process.env.ENCRYPTION_KEY;
        delete process.env.DATABASE_DRIVER;
        delete process.env.DATABASE_URL;
        delete process.env.CORS_ORIGIN;
        process.env.OTP_PROVIDER = 'console';
        delete process.env.TWILIO_ACCOUNT_SID;
        delete process.env.TWILIO_AUTH_TOKEN;
        delete process.env.TWILIO_FROM_PHONE;
        delete process.env.COLUMN_API_KEY;
        delete process.env.COLUMN_WEBHOOK_SECRET;
        delete process.env.COLUMN_ENABLED;

        const config = getBackendConfig();
        const errors = getProductionConfigErrors(config);

        expect(config.otpProvider).toBe('console');
        expect(errors).not.toEqual(expect.arrayContaining([
            'Twilio OTP configuration is required',
        ]));
    });

    test('requires Twilio credentials only when Twilio is explicitly selected', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'prod-secret-64-chars-1234567890abcd';
        process.env.ENCRYPTION_KEY = 'prod-encryption-key-64-chars-1234567890abcd';
        process.env.DATABASE_DRIVER = 'postgres';
        process.env.DATABASE_URL = 'postgres://user:pass@host/db';
        process.env.CORS_ORIGIN = 'https://example.com';
        process.env.OTP_PROVIDER = 'twilio';
        delete process.env.TWILIO_ACCOUNT_SID;
        delete process.env.TWILIO_AUTH_TOKEN;
        delete process.env.TWILIO_FROM_PHONE;

        const errors = getProductionConfigErrors(getBackendConfig());
        expect(errors).toEqual(expect.arrayContaining([
            'Twilio OTP configuration is required',
        ]));
    });
});
