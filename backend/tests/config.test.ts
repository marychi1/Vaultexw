import { getBackendConfig, getProductionConfigErrors } from '../src/config';

describe('backend config', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    test('uses environment overrides in production and enables Neon/Postgres when configured', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.COLUMN_LIVE_WIRES_ENABLED;
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
        expect(config.corsOrigins).toEqual([]);
        expect(config.otpProvider).toBe('twilio');
        expect(config.columnBaseUrl).toBe('https://api.column.com');
        expect(config.columnEnabled).toBe(false);
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
        delete process.env.PORT;

        const config = getBackendConfig();

        expect(config.jwtSecret).toHaveLength(128);
        expect(config.port).toBe(3002);
        expect(config.jwtSecretConfigured).toBe(false);
        expect(config.encryptionKey.length).toBeGreaterThanOrEqual(32);
        expect(config.encryptionKeyConfigured).toBe(false);
        expect(config.supabaseEnabled).toBe(false);
        expect(config.databaseDriver).toBe('file');
        expect(config.postgresEnabled).toBe(false);
        expect(config.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']);
        expect(config.otpProvider).toBe('console');
        expect(getProductionConfigErrors(config)).toEqual([]);
    });

    test('keeps live Column wires disabled until production approval even when the environment flag is set', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'a'.repeat(64);
        process.env.ENCRYPTION_KEY = 'b'.repeat(64);
        process.env.CORS_ORIGIN = 'https://example.com';
        process.env.COLUMN_LIVE_WIRES_ENABLED = 'true';
        process.env.COLUMN_ENABLED = 'true';
        process.env.COLUMN_API_KEY = 'live_column_api_key';
        process.env.COLUMN_WEBHOOK_SECRET = 'column-webhook-secret';
        process.env.COLUMN_WEBHOOK_ENDPOINT_ID = 'endpoint-id';
        process.env.DATABASE_DRIVER = 'postgres';
        process.env.DATABASE_URL = 'postgres://host/db';

        const config = getBackendConfig();

        expect(config.columnLiveWiresEnabled).toBe(false);
        expect(getProductionConfigErrors(config)).toContain(
            'Live Column wires remain blocked pending production, compliance, and operational approval',
        );
        expect(getProductionConfigErrors(config)).toContain(
            'COLUMN_WIRE_BANK_ACCOUNT_ID and COLUMN_PLATFORM_ENTITY_ID are required for platform-funded wires',
        );

        process.env.COLUMN_WIRE_BANK_ACCOUNT_ID = 'bank_account_platform';
        process.env.COLUMN_PLATFORM_ENTITY_ID = 'entity_platform';
        const configured = getBackendConfig();
        expect(configured.columnWireBankAccountId).toBe('bank_account_platform');
        expect(configured.columnPlatformEntityId).toBe('entity_platform');
        expect(getProductionConfigErrors(configured)).not.toContain(
            'COLUMN_WIRE_BANK_ACCOUNT_ID and COLUMN_PLATFORM_ENTITY_ID are required for platform-funded wires',
        );
    });

    test('enables sandbox wires only outside production with explicit opt-in and a test key', () => {
        process.env.NODE_ENV = 'development';
        process.env.COLUMN_SANDBOX_WIRES_ENABLED = 'true';
        process.env.COLUMN_ENABLED = 'true';
        process.env.COLUMN_API_KEY = 'test_sandbox_key';
        process.env.DATABASE_DRIVER = 'postgres';
        process.env.DATABASE_URL = 'postgres://host/db';

        expect(getBackendConfig().columnSandboxWiresEnabled).toBe(true);

        process.env.COLUMN_API_KEY = 'live_production_key';
        expect(getBackendConfig().columnSandboxWiresEnabled).toBe(false);

        process.env.NODE_ENV = 'production';
        process.env.COLUMN_API_KEY = 'test_sandbox_key';
        expect(getBackendConfig().columnSandboxWiresEnabled).toBe(false);
    });

    test('enables customer counterparty creation only outside production with test credentials and PostgreSQL', () => {
        process.env.NODE_ENV = 'development';
        process.env.COLUMN_CUSTOMER_COUNTERPARTIES_ENABLED = 'true';
        process.env.COLUMN_ENABLED = 'true';
        process.env.COLUMN_API_KEY = 'test_sandbox_key';
        process.env.DATABASE_DRIVER = 'postgres';
        process.env.DATABASE_URL = 'postgres://host/db';

        expect(getBackendConfig().columnCustomerCounterpartiesEnabled).toBe(true);

        process.env.NODE_ENV = 'production';
        process.env.COLUMN_API_KEY = 'live_production_key';
        expect(getBackendConfig().columnCustomerCounterpartiesEnabled).toBe(false);
        expect(getProductionConfigErrors()).toContain(
            'Customer counterparty creation is limited to non-production environments using Column test credentials and PostgreSQL',
        );
    });

    test('rejects production startup when strong JWT and encryption secrets are not explicitly configured', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.JWT_SECRET;
        delete process.env.ENCRYPTION_KEY;

        const errors = getProductionConfigErrors(getBackendConfig());
        expect(errors).toContain('JWT_SECRET must be a strong production secret');
        expect(errors).toContain('ENCRYPTION_KEY must be a configured key of at least 32 characters');
    });

    test('rejects example secrets even when they meet minimum lengths', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = `replace-with-a-random-secret-${'x'.repeat(64)}`;
        process.env.ENCRYPTION_KEY = `replace-with-a-32-byte-random-key-${'x'.repeat(32)}`;

        const errors = getProductionConfigErrors(getBackendConfig());
        expect(errors).toContain('JWT_SECRET must be a strong production secret');
        expect(errors).toContain('ENCRYPTION_KEY must be a configured key of at least 32 characters');
    });

    test('rejects sandbox Column credentials pointed at an unapproved host', () => {
        process.env.NODE_ENV = 'development';
        process.env.COLUMN_ENABLED = 'true';
        process.env.COLUMN_SANDBOX_WIRES_ENABLED = 'true';
        process.env.COLUMN_API_KEY = 'test_sandbox_key';
        process.env.COLUMN_BASE_URL = 'https://example.invalid';

        const config = getBackendConfig();
        expect(config.columnEnabled).toBe(false);
        expect(config.columnSandboxWiresEnabled).toBe(false);
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
