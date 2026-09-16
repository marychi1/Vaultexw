import { getBackendConfig } from '../src/config';

describe('backend config', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    test('uses environment overrides in production and rejects missing required values', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'prod-secret';
        process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
        process.env.POLYGON_RPC_URL = 'https://rpc.example.com';
        process.env.USDT_CONTRACT_ADDRESS = '0xabc';
        process.env.SUPABASE_URL = 'https://project.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'anon-key';

        const config = getBackendConfig();

        expect(config.jwtSecret).toBe('prod-secret');
        expect(config.encryptionKey).toBe('12345678901234567890123456789012');
        expect(config.polygonRpcUrl).toBe('https://rpc.example.com');
        expect(config.usdtContractAddress).toBe('0xabc');
        expect(config.supabaseUrl).toBe('https://project.supabase.co');
        expect(config.supabaseEnabled).toBe(true);
    });

    test('falls back to safe development defaults when values are missing', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.JWT_SECRET;
        delete process.env.ENCRYPTION_KEY;
        delete process.env.POLYGON_RPC_URL;
        delete process.env.USDT_CONTRACT_ADDRESS;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_ANON_KEY;

        const config = getBackendConfig();

        expect(config.jwtSecret).toMatch(/dev|local/i);
        expect(config.encryptionKey.length).toBeGreaterThanOrEqual(32);
        expect(config.polygonRpcUrl).toMatch(/mumbai|localhost|rpc/i);
        expect(config.supabaseEnabled).toBe(false);
    });
});
