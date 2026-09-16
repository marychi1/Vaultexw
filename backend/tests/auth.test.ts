import request from 'supertest';
import app from '../src/index';
import Database from '../src/services/database';
import CryptoService from '../src/services/cryptoService';

describe('Auth and OTP flows', () => {
    beforeEach(() => {
        Database.resetAll();
    });

    test('request and verify OTP', async () => {
        const phone = '555-0001';
        const res = await request(app).post('/api/auth/request-otp').send({ phone });
        expect(res.status).toBe(200);
        const otp = Database.getOTPByPhone(phone);
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

    test('signup encrypts wallet private keys before storing them', async () => {
        const phone = '555-0007';
        const rawPrivateKey = 'raw-private-key-123';

        const signup = await request(app)
            .post('/api/auth/signup')
            .send({ phone, pin: '1234', walletAddress: '0xwallet-7', encryptedPrivateKey: rawPrivateKey, deviceId: 'dev7', deviceName: 'test' });

        expect(signup.status).toBe(201);

        const storedUser = Database.getUserByPhone(phone);
        expect(storedUser).toBeDefined();
        expect(storedUser!.encryptedPrivateKey).not.toBe(rawPrivateKey);
        expect(CryptoService.decrypt(storedUser!.encryptedPrivateKey)).toBe(rawPrivateKey);
    });
});
