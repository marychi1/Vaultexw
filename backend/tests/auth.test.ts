import request from 'supertest';
import crypto from 'crypto';
import app from '../src/index';
import Database from '../src/services/database';
import CryptoService from '../src/services/cryptoService';
import BlockchainService from '../src/services/blockchainService';

jest.spyOn(BlockchainService, 'getUSDTBalance').mockResolvedValue(0);

describe('Auth and OTP flows', () => {
    beforeEach(async () => {
        await Database.resetAll();
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

    test('signup, login and verify PIN', async () => {
        const phone = '555-0002';
        const signup = await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '1234', walletAddress: '0xabc', encryptedPrivateKey: 'enc', deviceId: 'dev1', deviceName: 'test' });
        expect(signup.status).toBe(201);

        const login = await request(app).post('/api/auth/login').send({ phone, pin: '1234', deviceId: 'dev1', deviceName: 'test' });
        expect(login.status).toBe(200);

        const verifyPin = await request(app).post('/api/auth/verify-pin').send({ phone, pin: '1234' });
        expect(verifyPin.status).toBe(200);
        expect(verifyPin.body.verified).toBe(true);
    });

    test('Column transfer lookup requires auth and remains disabled by default', async () => {
        const unauthorized = await request(app).get('/api/column/transfers/wire_test123');
        expect(unauthorized.status).toBe(401);

        const signup = await request(app)
            .post('/api/auth/signup')
            .send({ phone: '555-0009', pin: '1234', walletAddress: '0xwallet-9', encryptedPrivateKey: 'enc', deviceId: 'dev9', deviceName: 'test' });

        const lookup = await request(app)
            .get('/api/column/transfers/wire_test123')
            .set('Authorization', `Bearer ${signup.body.token}`);

        expect(lookup.status).toBe(503);
        expect(lookup.body.error).toMatch(/disabled/i);
    });

    test('Column wire creation requires a valid idempotency key and stays disabled by default', async () => {
        const signup = await request(app)
            .post('/api/auth/signup')
            .send({ phone: '555-0010', pin: '1234', walletAddress: '0xwallet-10', encryptedPrivateKey: 'enc', deviceId: 'dev10', deviceName: 'test' });

        const missingKey = await request(app)
            .post('/api/column/transfers/wire')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .send({ amount: 100, currencyCode: 'USD', bankAccountId: 'bacc_test', counterpartyId: 'cpty_test', pin: '1234' });
        expect(missingKey.status).toBe(400);

        const disabled = await request(app)
            .post('/api/column/transfers/wire')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .set('Idempotency-Key', 'idem_test_123456')
            .send({ amount: 100, currencyCode: 'USD', bankAccountId: 'bacc_test', counterpartyId: 'cpty_test', pin: '1234' });
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

    test('PIN lockout after repeated failures', async () => {
        const phone = '555-0003';
        await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '9999', walletAddress: '0xabc', encryptedPrivateKey: 'enc', deviceId: 'dev2', deviceName: 'test' });

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

    test('device revoke blocks token and notifications are available', async () => {
        const phone = '555-0004';
        const signup = await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '1234', walletAddress: '0xabc', encryptedPrivateKey: 'enc', deviceId: 'dev3', deviceName: 'test' });

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
        const signup = await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '1234', walletAddress: '0xabc', encryptedPrivateKey: 'enc', deviceId: 'dev4', deviceName: 'test' });

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

    test('wallet endpoint returns balance and transaction history for a signed-in user', async () => {
        const phone = '555-0006';
        const signup = await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '1234', walletAddress: '0xwallet-6', encryptedPrivateKey: 'enc', deviceId: 'dev6', deviceName: 'test' });

        expect(signup.status).toBe(201);

        const walletRes = await request(app)
            .get('/api/wallet')
            .set('Authorization', `Bearer ${signup.body.token}`);

        expect(walletRes.status).toBe(200);
        expect(walletRes.body.address).toBe('0xwallet-6');
        expect(walletRes.body.balance).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(walletRes.body.transactions)).toBe(true);
        expect(walletRes.body.transactions.length).toBeGreaterThanOrEqual(0);
    });

    test('wallet history persists normalized transactions for a signed-in user', async () => {
        const phone = '555-0008';
        const signup = await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '1234', walletAddress: '0xwallet-8', encryptedPrivateKey: 'enc', deviceId: 'dev8', deviceName: 'test' });

        expect(signup.status).toBe(201);
        const user = await Database.getUserByPhone(phone);
        expect(user).toBeDefined();

        await Database.createTransaction(user!.id, {
            id: 'tx-history-8',
            type: 'withdrawal',
            amount: 12.5,
            date: '2026-09-15',
            status: 'completed',
        }, '0xtransaction-8');

        const walletRes = await request(app)
            .get('/api/wallet')
            .set('Authorization', `Bearer ${signup.body.token}`);

        expect(walletRes.status).toBe(200);
        expect(walletRes.body.transactions[0]).toMatchObject({
            id: 'tx-history-8',
            type: 'withdrawal',
            amount: 12.5,
            status: 'completed',
        });
    });

    test('wallet send validates recipient and amount before blockchain submission', async () => {
        const phone = '555-0009';
        const signup = await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '1234', walletAddress: '0xwallet-9', encryptedPrivateKey: 'enc', deviceId: 'dev9', deviceName: 'test' });

        expect(signup.status).toBe(201);
        const invalidAddress = await request(app)
            .post('/api/wallet/send')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .send({ to: 'not-an-address', amount: 1 });
        expect(invalidAddress.status).toBe(400);

        const invalidAmount = await request(app)
            .post('/api/wallet/send')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .send({ to: '0x0000000000000000000000000000000000000009', amount: '1.1234567' });
        expect(invalidAmount.status).toBe(400);

        const invalidPin = await request(app)
            .post('/api/wallet/send')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .send({ to: '0x0000000000000000000000000000000000000009', amount: 1, pin: '0000' });
        expect(invalidPin.status).toBe(401);

        const blockedMainnetTransfer = await request(app)
            .post('/api/wallet/send')
            .set('Authorization', `Bearer ${signup.body.token}`)
            .send({ to: '0x0000000000000000000000000000000000000009', amount: 1, pin: '1234' });
        expect(blockedMainnetTransfer.status).toBe(403);
        expect(blockedMainnetTransfer.body.error).toMatch(/disabled/i);
    });

    test('signup encrypts wallet private keys before storing them', async () => {
        const phone = '555-0007';
        const rawPrivateKey = 'raw-private-key-123';

        const signup = await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '1234', walletAddress: '0xwallet-7', encryptedPrivateKey: rawPrivateKey, deviceId: 'dev7', deviceName: 'test' });

        expect(signup.status).toBe(201);

        const storedUser = await Database.getUserByPhone(phone);
        expect(storedUser).toBeDefined();
        expect(storedUser!.encryptedPrivateKey).not.toBe(rawPrivateKey);
        expect(CryptoService.decrypt(storedUser!.encryptedPrivateKey)).toBe(rawPrivateKey);
    });
});
