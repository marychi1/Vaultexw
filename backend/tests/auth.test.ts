import request from 'supertest';
import crypto from 'crypto';
import app from '../src/index';
import Database from '../src/services/database';
import AuthService from '../src/services/authService';
import PostgresService from '../src/services/postgresService';

async function signupWithOtp(payload: { phone: string; [key: string]: unknown }) {
    await request(app).post('/api/auth/request-otp').send({ phone: payload.phone }).expect(200);
    const otp = await Database.getOTPByPhone(payload.phone);
    if (!otp) throw new Error('Signup OTP was not created');
    return request(app).post('/api/auth/signup').send({ ...payload, code: otp.code });
}

describe('Auth and OTP flows', () => {
    if (process.env.POSTGRES_INTEGRATION_TESTS === 'true') {
        test('runs against PostgreSQL rather than the file-backed test adapter', () => {
            expect(Database.getPersistenceMode()).toBe('postgres');
        });
    }

    beforeEach(async () => {
        await Database.resetAll();
    });

    test('health endpoint reports database readiness without exposing connection details', async () => {
        const response = await request(app).get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: 'ok',
            database: Database.getPersistenceMode(),
        });
        expect(response.headers['cache-control']).toBe('no-store');
        expect(JSON.stringify(response.body)).not.toMatch(/postgresql:\/\/|password|secret/i);
    });

    test('environment status reports the environment and disabled wire state without caching', async () => {
        const response = await request(app).get('/api/environment');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ environment: 'development', wireSubmissions: 'disabled' });
        expect(response.headers['cache-control']).toBe('no-store');
    });

    test('request and verify OTP', async () => {
        const phone = '555-0001';
        const res = await request(app).post('/api/auth/request-otp').send({ phone });
        expect(res.status).toBe(200);
        const otp = await Database.getOTPByPhone(phone);
        expect(otp).toBeDefined();

        const verify = await request(app).post('/api/auth/verify-otp').send({ phone, code: otp!.code });
        expect(verify.status).toBe(200);
        expect(verify.body.verified).toBe(true);
    });

    test('signup requires and consumes a valid OTP', async () => {
        const phone = '555-0021';
        const missingOtp = await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '1234' });
        expect(missingOtp.status).toBe(400);

        await request(app).post('/api/auth/request-otp').send({ phone }).expect(200);
        const otp = await Database.getOTPByPhone(phone);
        expect(otp).toBeDefined();

        const signup = await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '1234', code: otp!.code });
        expect(signup.status).toBe(201);

        const reusedOtp = await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '1234', code: otp!.code });
        expect(reusedOtp.status).toBe(401);
    });

    test('links a confirmed Supabase customer using the backend PIN and a one-time phone OTP', async () => {
        const previousSupabaseUrl = process.env.SUPABASE_URL;
        const previousSupabaseKey = process.env.SUPABASE_ANON_KEY;
        process.env.SUPABASE_URL = 'https://project.supabase.co';
        process.env.SUPABASE_ANON_KEY = 'test-anon-key';
        const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
            id: 'supabase-customer-1',
            email: 'customer@example.com',
            email_confirmed_at: '2025-01-01T00:00:00.000Z',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

        try {
            const phone = '555-0020';
            const signup = await signupWithOtp({ phone, pin: '1234', deviceId: 'link-test-device', deviceName: 'test' });
            expect(signup.status).toBe(201);

            await request(app)
                .post('/api/auth/request-link-otp')
                .set('Authorization', 'Bearer verified-supabase-token')
                .send({ phone })
                .expect(200);
            const otp = await Database.getOTPByPhone(phone);
            expect(otp).toBeDefined();

            const link = await request(app)
                .post('/api/auth/link-customer')
                .set('Authorization', 'Bearer verified-supabase-token')
                .send({ phone, pin: '1234', code: otp!.code });
            expect(link.status).toBe(201);
            expect(link.body).toEqual({ linked: true, phone: '***0020' });
            expect((await Database.getUserByPhone(phone))?.supabaseUserId).toBe('supabase-customer-1');
            expect(await Database.consumeOTP(phone, otp!.code)).toBe(false);

            const linkStatus = await request(app)
                .get('/api/auth/customer-link')
                .set('Authorization', 'Bearer verified-supabase-token');
            expect(linkStatus.status).toBe(200);
            expect(linkStatus.body).toEqual({ linked: true, phone: '***0020' });

            const duplicateLink = await request(app)
                .post('/api/auth/link-customer')
                .set('Authorization', 'Bearer verified-supabase-token')
                .send({ phone, pin: '1234', code: otp!.code });
            expect(duplicateLink.status).toBe(409);
        } finally {
            fetchMock.mockRestore();
            if (previousSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
            else process.env.SUPABASE_URL = previousSupabaseUrl;
            if (previousSupabaseKey === undefined) delete process.env.SUPABASE_ANON_KEY;
            else process.env.SUPABASE_ANON_KEY = previousSupabaseKey;
        }
    });

    test('signup, login and verify PIN', async () => {
        const phone = '555-0002';
        const signup = await signupWithOtp({ phone, pin: '1234', walletAddress: '0xabc', encryptedPrivateKey: 'enc', deviceId: 'dev1', deviceName: 'test' });
        expect(signup.status).toBe(201);
        expect(signup.body.user).not.toHaveProperty('encryptedPrivateKey');
        expect(signup.body.user.walletAddress).not.toBe('0xabc');

        const login = await request(app).post('/api/auth/login').send({ phone, pin: '1234', deviceId: 'dev1', deviceName: 'test' });
        expect(login.status).toBe(200);
        expect(login.body.user).not.toHaveProperty('encryptedPrivateKey');

        const verifyPin = await request(app).post('/api/auth/verify-pin').send({ phone, pin: '1234' });
        expect(verifyPin.status).toBe(200);
        expect(verifyPin.body.verified).toBe(true);
    });

    test('Column transfer lookup requires auth and remains disabled by default', async () => {
        const unauthorized = await request(app).get('/api/column/transfers/wire_test123');
        expect(unauthorized.status).toBe(401);

        const signup = await signupWithOtp({ phone: '555-0009', pin: '1234', walletAddress: '0xwallet-9', encryptedPrivateKey: 'enc', deviceId: 'dev9', deviceName: 'test' });

        const lookup = await request(app)
            .get('/api/column/transfers/wire_test123')
            .set('Authorization', `Bearer ${signup.body.token}`);

        expect(lookup.status).toBe(503);
        expect(lookup.body.error).toMatch(/disabled/i);
    });

    test('Column wire creation requires a valid idempotency key and stays disabled by default', async () => {
        const signup = await signupWithOtp({ phone: '555-0010', pin: '1234', walletAddress: '0xwallet-10', encryptedPrivateKey: 'enc', deviceId: 'dev10', deviceName: 'test' });

        const missingKey = await request(app)
            .post('/api/column/transfers/wire')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .send({ amount: 100, currencyCode: 'USD', recipientName: 'Test Recipient', bankAccountId: 'bacc_test', counterpartyId: 'cpty_test', pin: '1234' });
        expect(missingKey.status).toBe(400);

        const disabled = await request(app)
            .post('/api/column/transfers/wire')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .set('Idempotency-Key', 'idem_test_123456')
            .send({ amount: 100, currencyCode: 'USD', recipientName: 'Test Recipient', bankAccountId: 'bacc_test', counterpartyId: 'cpty_test', pin: '1234' });
        expect(disabled.status).toBe(503);
        expect(disabled.body.error).toMatch(/disabled/i);
    });

    test('Column webhook verifies signatures and ignores duplicate events', async () => {
        process.env.COLUMN_API_KEY = 'test-column-key';
        process.env.COLUMN_WEBHOOK_SECRET = 'test-webhook-secret';
        process.env.COLUMN_WEBHOOK_ENDPOINT_ID = 'whep_test';
        process.env.COLUMN_ENABLED = 'true';

        const payload = JSON.stringify({
            id: 'evnt_test_1',
            type: 'wire.outgoing_transfer.completed',
            data: { id: 'wire_test_1', status: 'COMPLETED' },
        });
        const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(payload).digest('hex');

        const first = await request(app)
            .post('/api/webhooks/column')
            .set('Content-Type', 'application/json')
            .set('Column-Signature', signature)
            .set('Webhook-Endpoint-Id', 'whep_test')
            .send(payload);
        expect(first.status).toBe(200);
        expect(first.body.duplicate).toBe(false);

        const duplicate = await request(app)
            .post('/api/webhooks/column')
            .set('Content-Type', 'application/json')
            .set('Column-Signature', signature)
            .set('Webhook-Endpoint-Id', 'whep_test')
            .send(payload);
        expect(duplicate.status).toBe(200);
        expect(duplicate.body.duplicate).toBe(true);

        const invalid = await request(app)
            .post('/api/webhooks/column')
            .set('Content-Type', 'application/json')
            .set('Column-Signature', '00'.repeat(32))
            .set('Webhook-Endpoint-Id', 'whep_test')
            .send(payload);
        expect(invalid.status).toBe(401);

        delete process.env.COLUMN_API_KEY;
        delete process.env.COLUMN_WEBHOOK_SECRET;
        delete process.env.COLUMN_WEBHOOK_ENDPOINT_ID;
        delete process.env.COLUMN_ENABLED;
    });

    test('concurrent PIN failures increment atomically and establish lockout', async () => {
        const phone = '555-1031';
        const signup = await signupWithOtp({
            phone, pin: '2468', deviceId: 'pin-race-device', deviceName: 'test'
        });
        expect(signup.status).toBe(201);
        const user = await Database.getUserByPhone(phone);
        if (!user) throw new Error('Test user was not created');

        const outcomes = await Promise.all(
            Array.from({ length: 5 }, () => Database.recordPinFailure(user.id, 5, 15))
        );
        const refreshed = await Database.getUserByPhone(phone);
        expect(outcomes).toHaveLength(5);
        expect(refreshed?.pinFailedAttempts).toBe(5);
        expect(refreshed?.pinLockedUntil?.getTime()).toBeGreaterThan(Date.now());
        await expect(AuthService.verifyPINWithLockout(phone, '2468')).rejects.toThrow(/locked/i);
    });

    test('PIN success cannot clear an active lockout', async () => {
        const phone = '555-1032';
        const signup = await signupWithOtp({
            phone, pin: '1357', deviceId: 'pin-lock-device', deviceName: 'test'
        });
        expect(signup.status).toBe(201);
        const user = await Database.getUserByPhone(phone);
        if (!user) throw new Error('Test user was not created');

        await Database.updateUser(user.id, {
            pinFailedAttempts: 5,
            pinLockedUntil: new Date(Date.now() + 60_000),
        });
        await expect(AuthService.verifyPINWithLockout(phone, '1357')).rejects.toThrow(/locked/i);
        const lockedUser = await Database.getUserByPhone(phone);
        expect(lockedUser?.pinFailedAttempts).toBe(5);
        expect(lockedUser?.pinLockedUntil?.getTime()).toBeGreaterThan(Date.now());
    });

    test('WebAuthn challenges are one-time and expired challenges are rejected', async () => {
        const phone = '555-1033';
        await Database.createWebAuthnChallenge(phone, 'single-use-challenge');
        const first = await Database.consumeWebAuthnChallenge(phone, 120);
        const replay = await Database.consumeWebAuthnChallenge(phone, 120);
        expect(first?.challenge).toBe('single-use-challenge');
        expect(replay).toBeUndefined();

        await Database.createWebAuthnChallenge(phone, 'expired-challenge');
        const expired = await Database.consumeWebAuthnChallenge(phone, 0);
        expect(expired).toBeUndefined();
        const expiredReplay = await Database.consumeWebAuthnChallenge(phone, 120);
        expect(expiredReplay).toBeUndefined();
    });

    test('PIN lockout after repeated failures', async () => {
        const phone = '555-0003';
        await signupWithOtp({ phone, pin: '9999', walletAddress: '0xabc', encryptedPrivateKey: 'enc', deviceId: 'dev2', deviceName: 'test' });

        // 5 wrong attempts
        for (let i = 0; i < 5; i++) {
            const res = await request(app).post('/api/auth/login').send({ phone, pin: '0000', deviceId: 'dev2', deviceName: 'test' });
            expect(res.status).toBe(401);
        }

        // Now account should be locked: login returns 401 with locked error
        const locked = await request(app).post('/api/auth/login').send({ phone, pin: '9999', deviceId: 'dev2', deviceName: 'test' });
        expect(locked.status).toBe(401);
        expect(locked.body.error).toMatch(/locked/i);
    });

    test('prevents a different account from reusing an existing device ID', async () => {
        const first = await signupWithOtp({
            phone: '555-1011', pin: '1234', deviceId: 'shared-device', deviceName: 'first'
        });
        expect(first.status).toBe(201);

        const second = await signupWithOtp({
            phone: '555-1012', pin: '5678', deviceId: 'second-device', deviceName: 'second'
        });
        expect(second.status).toBe(201);

        const reuse = await request(app)
            .post('/api/auth/login')
            .send({ phone: '555-1012', pin: '5678', deviceId: 'shared-device', deviceName: 'second' });

        expect(reuse.status).toBe(401);
        expect(reuse.body.error).toMatch(/already associated/i);
    });

    if (process.env.POSTGRES_INTEGRATION_TESTS === 'true') {
        test('global device-ID migration refuses existing cross-account duplicates', async () => {
            const pool = PostgresService.getPool();
            if (!pool) throw new Error('PostgreSQL pool is not configured');

            const userIds = ['migration-duplicate-user-a', 'migration-duplicate-user-b'];
            try {
                await PostgresService.ensureSchema();
                await pool.query('DROP INDEX IF EXISTS devices_device_id_unique_idx');
                for (let i = 0; i < userIds.length; i++) {
                    await pool.query(
                        'INSERT INTO users (id, phone, pin_hash, wallet_address, encrypted_private_key) VALUES ($1, $2, $3, NULL, NULL)',
                        [userIds[i], `+1555999000${i}`, 'test-hash']
                    );
                    await pool.query(
                        'INSERT INTO devices (id, user_id, device_id, device_name, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
                        [`migration-duplicate-device-${i}`, userIds[i], 'legacy-shared-device-id', 'migration test', '127.0.0.1', 'jest']
                    );
                }

                (PostgresService as unknown as { schemaPromise: Promise<boolean> | null }).schemaPromise = null;
                await expect(PostgresService.ensureSchema()).resolves.toBe(false);
            } finally {
                await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [userIds]);
                (PostgresService as unknown as { schemaPromise: Promise<boolean> | null }).schemaPromise = null;
                await expect(PostgresService.ensureSchema()).resolves.toBe(true);
            }
        });
    }

    test('concurrent cross-account device registration allows only one owner', async () => {
        const firstUser = await signupWithOtp({
            phone: '555-1021', pin: '1234', deviceId: 'seed-device-1', deviceName: 'first'
        });
        const secondUser = await signupWithOtp({
            phone: '555-1022', pin: '5678', deviceId: 'seed-device-2', deviceName: 'second'
        });
        expect(firstUser.status).toBe(201);
        expect(secondUser.status).toBe(201);

        const first = await Database.getUserByPhone('555-1021');
        const second = await Database.getUserByPhone('555-1022');
        if (!first || !second) throw new Error('Test users were not created');

        const device = (id: string, userId: string) => ({
            id,
            userId,
            deviceId: 'contended-device-id',
            deviceName: 'concurrent test device',
            ipAddress: '127.0.0.1',
            userAgent: 'jest',
            authorized: true,
            lastActivity: new Date(),
            createdAt: new Date(),
        });

        const outcomes = await Promise.allSettled([
            Database.createDevice(device('contended-first', first.id)),
            Database.createDevice(device('contended-second', second.id)),
        ]);
        expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
        expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);

        const stored = await Database.getDeviceByDeviceId('contended-device-id');
        expect(stored).toBeDefined();
        expect([first.id, second.id]).toContain(stored!.userId);
    });

    test('rejects a valid JWT when its user does not own the referenced device', async () => {
        const first = await signupWithOtp({
            phone: '555-1013', pin: '1234', deviceId: 'owned-device', deviceName: 'first'
        });
        const second = await signupWithOtp({
            phone: '555-1014', pin: '5678', deviceId: 'other-device', deviceName: 'second'
        });
        expect(first.status).toBe(201);
        expect(second.status).toBe(201);

        const secondUser = await Database.getUserByPhone('555-1014');
        if (!secondUser) throw new Error('Second test user was not created');
        const mismatchedToken = AuthService.generateAuthToken(secondUser.id, 'owned-device');

        const response = await request(app)
            .get('/api/devices')
            .set('Authorization', `Bearer ${mismatchedToken}`);

        expect(response.status).toBe(403);
    });

    test('device revoke blocks token and notifications are available', async () => {
        const phone = '555-0004';
        const signup = await signupWithOtp({ phone, pin: '1234', walletAddress: '0xabc', encryptedPrivateKey: 'enc', deviceId: 'dev3', deviceName: 'test' });

        expect(signup.status).toBe(201);
        const token = signup.body.token;

        const devicesRes = await request(app)
            .get('/api/devices')
            .set('Authorization', `Bearer ${token}`);
        expect(devicesRes.status).toBe(200);
        expect(devicesRes.body).toHaveLength(1);
        expect(devicesRes.body[0].deviceId).toBe('dev3');
        expect(devicesRes.body[0].authorized).toBe(true);

        const notificationsRes = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${token}`);
        expect(notificationsRes.status).toBe(200);
        expect(notificationsRes.body.length).toBeGreaterThanOrEqual(1);

        const revokeRes = await request(app)
            .delete(`/api/devices/${devicesRes.body[0].id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(revokeRes.status).toBe(200);
        expect(revokeRes.body.device.authorized).toBe(false);

        const postRevoke = await request(app)
            .get('/api/devices')
            .set('Authorization', `Bearer ${token}`);
        expect(postRevoke.status).toBe(403);
        expect(postRevoke.body.error).toMatch(/revoked/i);
    });

    test('revoked device ID cannot login again', async () => {
        const phone = '555-0005';
        const signup = await signupWithOtp({ phone, pin: '1234', walletAddress: '0xabc', encryptedPrivateKey: 'enc', deviceId: 'dev4', deviceName: 'test' });

        expect(signup.status).toBe(201);
        const token = signup.body.token;

        const revokeRes = await request(app)
            .delete(`/api/devices/dev4`)
            .set('Authorization', `Bearer ${token}`);
        expect(revokeRes.status).toBe(200);
        expect(revokeRes.body.device.authorized).toBe(false);

        const loginAgain = await request(app)
            .post('/api/auth/login')
            .send({ phone, pin: '1234', deviceId: 'dev4', deviceName: 'test' });
        expect(loginAgain.status).toBe(401);
        expect(loginAgain.body.error).toMatch(/revoked/i);
    });

    test('new signups do not create crypto wallets and wallet endpoints are disabled', async () => {
        const phone = '555-0006';
        const signup = await signupWithOtp({ phone, pin: '1234', walletAddress: '0xwallet-6', encryptedPrivateKey: 'enc', deviceId: 'dev6', deviceName: 'test' });

        expect(signup.status).toBe(201);

        const walletRes = await request(app)
            .get('/api/wallet')
            .set('Authorization', `Bearer ${signup.body.token}`);

        expect(walletRes.status).toBe(410);
        expect(walletRes.body.error).toMatch(/not offered/i);
        const user = await Database.getUserByPhone(phone);
        expect(user?.walletAddress).toBeNull();
        expect(user?.encryptedPrivateKey).toBeNull();
    });

    test('wallet history persists normalized transactions for a signed-in user', async () => {
        const phone = '555-0008';
        const signup = await signupWithOtp({ phone, pin: '1234', walletAddress: '0xwallet-8', encryptedPrivateKey: 'enc', deviceId: 'dev8', deviceName: 'test' });

        expect(signup.status).toBe(201);
        const user = await Database.getUserByPhone(phone);
        expect(user).toBeDefined();

        await Database.createTransaction(user!.id, {
            id: 'tx-history-8',
            type: 'withdrawal',
            amount: 12.5,
            date: '2026-09-15',
            status: 'completed',
            reference: '0xtransaction-8',
            recipient: '0xrecipient-8',
        }, '0xtransaction-8');

        const walletRes = await request(app)
            .get('/api/wallet')
            .set('Authorization', `Bearer ${signup.body.token}`);

        expect(walletRes.status).toBe(410);
        expect(walletRes.body.error).toMatch(/not offered/i);
    });

    test('wallet send is disabled for all requests', async () => {
        const phone = '555-0009';
        const signup = await signupWithOtp({ phone: '555-0009', pin: '1234', walletAddress: '0xwallet-9', encryptedPrivateKey: 'enc', deviceId: 'dev9', deviceName: 'test' });

        expect(signup.status).toBe(201);
        const invalidAddress = await request(app)
            .post('/api/wallet/send')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .send({ to: 'not-an-address', amount: 1 });
        expect(invalidAddress.status).toBe(410);

        const invalidAmount = await request(app)
            .post('/api/wallet/send')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .send({ to: '0x0000000000000000000000000000000000000009', amount: '1.1234567' });
        expect(invalidAmount.status).toBe(410);

        const invalidPin = await request(app)
            .post('/api/wallet/send')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .send({ to: '0x0000000000000000000000000000000000000009', amount: 1, pin: '0000' });
        expect(invalidPin.status).toBe(410);

        const blockedMainnetTransfer = await request(app)
            .post('/api/wallet/send')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .send({ to: '0x0000000000000000000000000000000000000009', amount: 1, pin: '1234' });
        expect(blockedMainnetTransfer.status).toBe(410);
        expect(blockedMainnetTransfer.body.error).toMatch(/not offered/i);
    });

    test('signup ignores submitted crypto wallet data', async () => {
        const phone = '555-0007';
        const rawPrivateKey = 'raw-private-key-123';

        const signup = await signupWithOtp({ phone, pin: '1234', walletAddress: '0xwallet-7', encryptedPrivateKey: rawPrivateKey, deviceId: 'dev7', deviceName: 'test' });

        expect(signup.status).toBe(201);

        const storedUser = await Database.getUserByPhone(phone);
        expect(storedUser).toBeDefined();
        expect(storedUser!.walletAddress).toBeNull();
        expect(storedUser!.encryptedPrivateKey).toBeNull();
    });
});
