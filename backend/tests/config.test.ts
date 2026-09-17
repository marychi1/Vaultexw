import { getBackendConfig, getProductionConfigErrors } from '../src/config';

describe('backend config', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    test('uses environment overrides in production and enables Neon/Postgres when configured', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'prod-secret';
        process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
        process.env.POLYGON_RPC_URL = 'https://rpc.example.com';
        process.env.USDT_CONTRACT_ADDRESS = '0xabc';
        process.env.SUPABASE_URL = 'https://project.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'anon-key';
        process.env.DATABASE_DRIVER = 'postgres';
        process.env.DATABASE_URL = 'postgres://user:pass@host/db';
        process.env.OTP_PROVIDER = 'twilio';

        const config = getBackendConfig();

        expect(config.jwtSecret).toBe('prod-secret');
        expect(config.encryptionKey).toBe('12345678901234567890123456789012');
        expect(config.polygonRpcUrl).toBe('https://rpc.example.com');
        expect(config.usdtContractAddress).toBe('0xabc');
        expect(config.supabaseUrl).toBe('https://project.supabase.co');
        expect(config.supabaseEnabled).toBe(true);
        expect(config.databaseDriver).toBe('postgres');
        expect(config.databaseUrl).toBe('postgres://user:pass@host/db');
        expect(config.postgresEnabled).toBe(true);
        expect(config.allowMainnetTransfers).toBe(false);
        expect(config.maxDailyTransferUsdt).toBe(1000);
        expect(config.corsOrigins).toEqual([]);
        expect(config.otpProvider).toBe('twilio');
        expect(config.columnBaseUrl).toBe('https://api.column.com');
        expect(config.columnEnabled).toBe(false);
    });

    test('falls back to safe development defaults when values are missing', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.JWT_SECRET;
        delete process.env.ENCRYPTION_KEY;
        delete process.env.POLYGON_RPC_URL;
        delete process.env.USDT_CONTRACT_ADDRESS;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_ANON_KEY;
        delete process.env.DATABASE_DRIVER;
        delete process.env.DATABASE_URL;

        const config = getBackendConfig();

        expect(config.jwtSecret).toMatch(/dev|local/i);
        expect(config.encryptionKey.length).toBeGreaterThanOrEqual(32);
        expect(config.polygonRpcUrl).toMatch(/mumbai|localhost|rpc/i);
        expect(config.supabaseEnabled).toBe(false);
        expect(config.databaseDriver).toBe('file');
        expect(config.postgresEnabled).toBe(false);
        expect(config.allowMainnetTransfers).toBe(false);
        expect(config.maxDailyTransferUsdt).toBe(1000);
        expect(config.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']);
        expect(config.otpProvider).toBe('console');
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
