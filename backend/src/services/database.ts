import fs from 'fs';
import path from 'path';
import { User, Device, OTP, LoginNotification, WalletTransaction } from '../models/types';
import { getBackendConfig } from '../config';
import PostgresService from './postgresService';

const DATA_FILE = path.resolve(__dirname, '../../data/vaultex-db.json');

class Database {
    static getPersistenceMode(): 'file' | 'postgres' {
        const { postgresEnabled } = getBackendConfig();
        if (!postgresEnabled) {
            return 'file';
        }

        return PostgresService.getPool() ? 'postgres' : 'file';
    }

    private static users: User[] = [];
    private static devices: Device[] = [];
    private static otps: OTP[] = [];
    private static notifications: LoginNotification[] = [];
    private static webauthnChallenges: { phone: string; challenge: string; createdAt: Date }[] = [];
    private static credentials: { phone: string; credentialId: string; publicKey: string; counter: number }[] = [];
    private static columnWebhookEvents: { id: string; type: string; transferId?: string; payload: unknown; receivedAt: Date }[] = [];

    private static async postgresReady() {
        const pool = PostgresService.getPool();
        if (!pool) return null;
        if (!(await PostgresService.ensureSchema())) {
            throw new Error('Postgres schema initialization failed');
        }
        return pool;
    }

    private static mapUser(row: any): User {
        return {
            id: row.id,
            phone: row.phone,
            pinHash: row.pin_hash,
            walletAddress: row.wallet_address,
            encryptedPrivateKey: row.encrypted_private_key,
            verified: row.verified,
            createdAt: this.hydrateDate(row.created_at) as Date,
            balance: Number(row.balance ?? 0),
            transactions: [],
            lastLogin: this.hydrateDate(row.last_login) || undefined,
            pinFailedAttempts: row.pin_failed_attempts,
            pinLockedUntil: this.hydrateDate(row.pin_locked_until),
        };
    }

    private static mapDevice(row: any): Device {
        return { id: row.id, userId: row.user_id, deviceId: row.device_id, deviceName: row.device_name, ipAddress: row.ip_address, userAgent: row.user_agent, authorized: row.authorized, lastActivity: row.last_activity, createdAt: row.created_at };
    }

    private static mapOTP(row: any): OTP {
        return { id: row.id, phone: row.phone, code: row.code, expiresAt: row.expires_at, attempts: row.attempts, createdAt: row.created_at };
    }

    private static mapNotification(row: any): LoginNotification {
        return { id: row.id, userId: row.user_id, deviceId: row.device_id, deviceName: row.device_name, ipAddress: row.ip_address, timestamp: row.timestamp, read: row.read };
    }

    private static mapTransaction(row: any): WalletTransaction {
        return { id: row.id, type: row.type, amount: Number(row.amount), date: new Date(row.created_at).toISOString().slice(0, 10), status: row.status };
    }

    private static ensureDataFile() {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify({
                users: [],
                devices: [],
                otps: [],
                notifications: [],
                webauthnChallenges: [],
                credentials: [],
                columnWebhookEvents: [],
            }, null, 2));
        }
    }

    private static hydrateDate(value: string | Date | undefined | null): Date | undefined | null {
        if (value === undefined) return undefined;
        if (value === null) return null;
        if (value instanceof Date) return value;
        if (value === '') return null;
        return new Date(value);
    }

    private static loadFromDisk() {
        this.ensureDataFile();

        try {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            if (!raw.trim()) {
                this.users = [];
                this.devices = [];
                this.otps = [];
                this.notifications = [];
                this.webauthnChallenges = [];
                this.credentials = [];
                this.columnWebhookEvents = [];
                return;
            }

            const parsed = JSON.parse(raw);
            this.users = (parsed.users || []).map((user: any) => ({
                ...user,
                createdAt: this.hydrateDate(user.createdAt),
                lastLogin: user.lastLogin ? this.hydrateDate(user.lastLogin) : undefined,
                pinLockedUntil: user.pinLockedUntil ? this.hydrateDate(user.pinLockedUntil) : null,
                balance: Number(user.balance ?? 0),
                transactions: Array.isArray(user.transactions) ? user.transactions : [],
            }));
            this.devices = (parsed.devices || []).map((device: any) => ({
                ...device,
                createdAt: this.hydrateDate(device.createdAt),
                lastActivity: this.hydrateDate(device.lastActivity),
            }));
            this.otps = (parsed.otps || []).map((otp: any) => ({
                ...otp,
                expiresAt: this.hydrateDate(otp.expiresAt),
                createdAt: this.hydrateDate(otp.createdAt),
            }));
            this.notifications = (parsed.notifications || []).map((notification: any) => ({
                ...notification,
                timestamp: this.hydrateDate(notification.timestamp),
            }));
            this.webauthnChallenges = (parsed.webauthnChallenges || []).map((entry: any) => ({
                ...entry,
                createdAt: this.hydrateDate(entry.createdAt),
            }));
            this.credentials = parsed.credentials || [];
            this.columnWebhookEvents = (parsed.columnWebhookEvents || []).map((event: any) => ({
                ...event,
                receivedAt: this.hydrateDate(event.receivedAt) || new Date(),
            }));
        } catch {
            this.users = [];
            this.devices = [];
            this.otps = [];
            this.notifications = [];
            this.webauthnChallenges = [];
            this.credentials = [];
            this.columnWebhookEvents = [];
        }
    }

    private static persist() {
        this.ensureDataFile();
        const payload = {
            users: this.users,
            devices: this.devices,
            otps: this.otps,
            notifications: this.notifications,
            webauthnChallenges: this.webauthnChallenges,
            credentials: this.credentials,
            columnWebhookEvents: this.columnWebhookEvents,
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2));
    }

    static async resetAll() {
        const pool = await this.postgresReady();
        if (pool) {
            await pool.query('TRUNCATE transactions, credentials, webauthn_challenges, notifications, otps, devices, users CASCADE');
            return;
        }
        this.users = [];
        this.devices = [];
        this.otps = [];
        this.notifications = [];
        this.webauthnChallenges = [];
        this.credentials = [];
        this.columnWebhookEvents = [];
        this.persist();
    }

    static initialize() {
        this.loadFromDisk();

        if (this.getPersistenceMode() === 'postgres') {
            void PostgresService.ensureSchema();
        }
    }

    // User operations
    static async getUserByPhone(phone: string): Promise<User | undefined> {
        const pool = await this.postgresReady();
        if (pool) {
            const result = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
            return result.rows[0] ? this.mapUser(result.rows[0]) : undefined;
        }
        return this.users.find((u) => u.phone === phone);
    }

    static async getUserById(id: string): Promise<User | undefined> {
        const pool = await this.postgresReady();
        if (pool) {
            const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
            return result.rows[0] ? this.mapUser(result.rows[0]) : undefined;
        }
        return this.users.find((u) => u.id === id);
    }

    static async createUser(user: User): Promise<User> {
        // initialize security fields
        user.pinFailedAttempts = user.pinFailedAttempts || 0;
        user.pinLockedUntil = user.pinLockedUntil || null;
        user.balance = Number(user.balance ?? 0);
        user.transactions = Array.isArray(user.transactions) ? user.transactions : [];
        const pool = await this.postgresReady();
        if (pool) {
            await pool.query(`INSERT INTO users (id, phone, pin_hash, wallet_address, encrypted_private_key, verified, created_at, balance, last_login, pin_failed_attempts, pin_locked_until)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [user.id, user.phone, user.pinHash, user.walletAddress, user.encryptedPrivateKey, user.verified, user.createdAt, user.balance, user.lastLogin || null, user.pinFailedAttempts, user.pinLockedUntil]);
            return user;
        }
        this.users.push(user);
        this.persist();
        return user;
    }

    static async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
        const pool = await this.postgresReady();
        if (pool) {
            const columns: Record<string, unknown> = { last_login: updates.lastLogin, pin_failed_attempts: updates.pinFailedAttempts, pin_locked_until: updates.pinLockedUntil, balance: updates.balance };
            const entries = Object.entries(columns).filter(([, value]) => value !== undefined);
            if (entries.length) {
                const values = entries.map(([, value]) => value);
                const setClause = entries.map(([column], index) => `${column} = $${index + 1}`).join(', ');
                values.push(id);
                await pool.query(`UPDATE users SET ${setClause} WHERE id = $${values.length}`, values);
            }
            return this.getUserById(id);
        }
        const user = this.users.find((entry) => entry.id === id);
        if (user) {
            Object.assign(user, updates);
            this.persist();
        }
        return user;
    }

    // Device operations
    static async getDeviceById(id: string): Promise<Device | undefined> {
        const pool = await this.postgresReady();
        if (pool) {
            const result = await pool.query('SELECT * FROM devices WHERE id = $1', [id]);
            return result.rows[0] ? this.mapDevice(result.rows[0]) : undefined;
        }
        return this.devices.find((d) => d.id === id);
    }

    static async getUserDevices(userId: string): Promise<Device[]> {
        const pool = await this.postgresReady();
        if (pool) return (await pool.query('SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at', [userId])).rows.map((row) => this.mapDevice(row));
        return this.devices.filter((d) => d.userId === userId);
    }

    static async createDevice(device: Device): Promise<Device> {
        const pool = await this.postgresReady();
        if (pool) {
            await pool.query(`INSERT INTO devices (id,user_id,device_id,device_name,ip_address,user_agent,authorized,last_activity,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [device.id, device.userId, device.deviceId, device.deviceName, device.ipAddress, device.userAgent, device.authorized, device.lastActivity, device.createdAt]);
            return device;
        }
        this.devices.push(device);
        this.persist();
        return device;
    }

    static async updateDevice(id: string, updates: Partial<Device>): Promise<Device | undefined> {
        const pool = await this.postgresReady();
        if (pool) {
            if (updates.lastActivity !== undefined) await pool.query('UPDATE devices SET last_activity = $1 WHERE id = $2', [updates.lastActivity, id]);
            return this.getDeviceById(id);
        }
        const device = this.devices.find((entry) => entry.id === id);
        if (device) {
            Object.assign(device, updates);
            this.persist();
        }
        return device;
    }

    static async revokeDevice(id: string): Promise<Device | undefined> {
        const pool = await this.postgresReady();
        if (pool) {
            await pool.query('UPDATE devices SET authorized = FALSE WHERE id = $1', [id]);
            return this.getDeviceById(id);
        }
        const device = this.devices.find((entry) => entry.id === id);
        if (device) {
            device.authorized = false;
            this.persist();
        }
        return device;
    }

    // OTP operations
    static async getOTPByPhone(phone: string): Promise<OTP | undefined> {
        const pool = await this.postgresReady();
        if (pool) {
            const result = await pool.query('SELECT * FROM otps WHERE phone = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1', [phone]);
            return result.rows[0] ? this.mapOTP(result.rows[0]) : undefined;
        }
        return this.otps.find((o) => o.phone === phone && o.expiresAt > new Date());
    }

    static async createOTP(otp: OTP): Promise<OTP> {
        const pool = await this.postgresReady();
        if (pool) {
            await pool.query('DELETE FROM otps WHERE phone = $1', [otp.phone]);
            await pool.query('INSERT INTO otps (id,phone,code,expires_at,attempts,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [otp.id, otp.phone, otp.code, otp.expiresAt, otp.attempts, otp.createdAt]);
            return otp;
        }
        // Remove old OTPs for this phone
        this.otps = this.otps.filter((o) => o.phone !== otp.phone);
        this.otps.push(otp);
        this.persist();
        return otp;
    }

    static async updateOTP(id: string, updates: Partial<OTP>): Promise<OTP | undefined> {
        const pool = await this.postgresReady();
        if (pool) {
            if (updates.attempts !== undefined) await pool.query('UPDATE otps SET attempts = $1 WHERE id = $2', [updates.attempts, id]);
            const result = await pool.query('SELECT * FROM otps WHERE id = $1', [id]);
            return result.rows[0] ? this.mapOTP(result.rows[0]) : undefined;
        }
        const otp = this.otps.find((entry) => entry.id === id);
        if (otp) {
            Object.assign(otp, updates);
            this.persist();
        }
        return otp;
    }

    // Notification operations
    static async getNotifications(userId: string): Promise<LoginNotification[]> {
        const pool = await this.postgresReady();
        if (pool) return (await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY timestamp DESC', [userId])).rows.map((row) => this.mapNotification(row));
        return this.notifications.filter((n) => n.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    static async createNotification(notification: LoginNotification): Promise<LoginNotification> {
        const pool = await this.postgresReady();
        if (pool) {
            await pool.query('INSERT INTO notifications (id,user_id,device_id,device_name,ip_address,timestamp,read) VALUES ($1,$2,$3,$4,$5,$6,$7)', [notification.id, notification.userId, notification.deviceId, notification.deviceName, notification.ipAddress, notification.timestamp, notification.read]);
            return notification;
        }
        this.notifications.push(notification);
        this.persist();
        return notification;
    }

    static async markNotificationAsRead(id: string): Promise<LoginNotification | undefined> {
        const pool = await this.postgresReady();
        if (pool) {
            await pool.query('UPDATE notifications SET read = TRUE WHERE id = $1', [id]);
            const result = await pool.query('SELECT * FROM notifications WHERE id = $1', [id]);
            return result.rows[0] ? this.mapNotification(result.rows[0]) : undefined;
        }
        const notification = this.notifications.find((entry) => entry.id === id);
        if (notification) {
            notification.read = true;
            this.persist();
        }
        return notification;
    }

    // WebAuthn challenge operations
    static async createWebAuthnChallenge(phone: string, challenge: string) {
        const pool = await this.postgresReady();
        if (pool) {
            const result = await pool.query(`INSERT INTO webauthn_challenges (phone,challenge,created_at) VALUES ($1,$2,NOW()) ON CONFLICT (phone) DO UPDATE SET challenge = EXCLUDED.challenge, created_at = NOW() RETURNING *`, [phone, challenge]);
            return { phone: result.rows[0].phone, challenge: result.rows[0].challenge, createdAt: result.rows[0].created_at };
        }
        // replace existing
        this.webauthnChallenges = this.webauthnChallenges.filter((c) => c.phone !== phone);
        const entry = { phone, challenge, createdAt: new Date() };
        this.webauthnChallenges.push(entry);
        this.persist();
        return entry;
    }

    static async getWebAuthnChallenge(phone: string) {
        const pool = await this.postgresReady();
        if (pool) {
            const result = await pool.query('SELECT * FROM webauthn_challenges WHERE phone = $1', [phone]);
            return result.rows[0] ? { phone: result.rows[0].phone, challenge: result.rows[0].challenge, createdAt: result.rows[0].created_at } : undefined;
        }
        return this.webauthnChallenges.find((c) => c.phone === phone);
    }

    static async removeWebAuthnChallenge(phone: string) {
        const pool = await this.postgresReady();
        if (pool) {
            await pool.query('DELETE FROM webauthn_challenges WHERE phone = $1', [phone]);
            return;
        }
        this.webauthnChallenges = this.webauthnChallenges.filter((c) => c.phone !== phone);
        this.persist();
    }

    // Credentials
    static async storeCredential(phone: string, credentialId: string, publicKey: string, counter: number) {
        const pool = await this.postgresReady();
        if (pool) {
            await pool.query(`INSERT INTO credentials (phone,credential_id,public_key,counter) VALUES ($1,$2,$3,$4) ON CONFLICT (phone,credential_id) DO UPDATE SET public_key = EXCLUDED.public_key, counter = EXCLUDED.counter`, [phone, credentialId, publicKey, counter]);
            return;
        }
        this.credentials = this.credentials.filter((c) => c.phone !== phone || c.credentialId !== credentialId);
        this.credentials.push({ phone, credentialId, publicKey, counter });
        this.persist();
    }

    static async getCredentialsForPhone(phone: string) {
        const pool = await this.postgresReady();
        if (pool) return (await pool.query('SELECT phone, credential_id, public_key, counter FROM credentials WHERE phone = $1', [phone])).rows.map((row) => ({ phone: row.phone, credentialId: row.credential_id, publicKey: row.public_key, counter: row.counter }));
        return this.credentials.filter((c) => c.phone === phone);
    }

    static async getCredential(phone: string, credentialId: string) {
        const pool = await this.postgresReady();
        if (pool) {
            const result = await pool.query('SELECT phone, credential_id, public_key, counter FROM credentials WHERE phone = $1 AND credential_id = $2', [phone, credentialId]);
            const row = result.rows[0];
            return row ? { phone: row.phone, credentialId: row.credential_id, publicKey: row.public_key, counter: row.counter } : undefined;
        }
        return this.credentials.find((c) => c.phone === phone && c.credentialId === credentialId);
    }

    static async updateCredentialCounter(phone: string, credentialId: string, counter: number) {
        const pool = await this.postgresReady();
        if (pool) {
            await pool.query('UPDATE credentials SET counter = $1 WHERE phone = $2 AND credential_id = $3', [counter, phone, credentialId]);
            return;
        }
        const credential = this.credentials.find((entry) => entry.phone === phone && entry.credentialId === credentialId);
        if (credential) {
            credential.counter = counter;
            this.persist();
        }
    }

    static async recordColumnWebhookEvent(event: { id: string; type: string; transferId?: string; payload: unknown }): Promise<boolean> {
        const pool = await this.postgresReady();
        if (pool) {
            const result = await pool.query(`
                INSERT INTO column_webhook_events (id,event_type,transfer_id,payload,received_at)
                VALUES ($1,$2,$3,$4,NOW())
                ON CONFLICT (id) DO NOTHING
                RETURNING id
            `, [event.id, event.type, event.transferId || null, event.payload]);
            return result.rowCount === 1;
        }

        if (this.columnWebhookEvents.some((entry) => entry.id === event.id)) return false;
        this.columnWebhookEvents.push({ ...event, receivedAt: new Date() });
        this.persist();
        return true;
    }

    static async getTransactions(userId: string): Promise<WalletTransaction[]> {
        const pool = await this.postgresReady();
        if (pool) return (await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC', [userId])).rows.map((row) => this.mapTransaction(row));
        const user = this.users.find((entry) => entry.id === userId);
        return user?.transactions || [];
    }

    static async getDailyWithdrawalTotal(userId: string): Promise<number> {
        const pool = await this.postgresReady();
        if (pool) {
            const result = await pool.query(`
                SELECT COALESCE(SUM(amount), 0) AS total
                FROM transactions
                WHERE user_id = $1
                  AND type = 'withdrawal'
                  AND created_at >= date_trunc('day', NOW())
            `, [userId]);
            return Number(result.rows[0]?.total ?? 0);
        }

        const today = new Date().toISOString().slice(0, 10);
        const user = this.users.find((entry) => entry.id === userId);
        return (user?.transactions || [])
            .filter((transaction) => transaction.type === 'withdrawal' && transaction.date === today)
            .reduce((total, transaction) => total + Math.max(0, Number(transaction.amount)), 0);
    }

    static async createTransaction(userId: string, transaction: WalletTransaction, txHash?: string): Promise<WalletTransaction> {
        const pool = await this.postgresReady();
        if (pool) {
            await pool.query('INSERT INTO transactions (id,user_id,type,amount,tx_hash,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [transaction.id, userId, transaction.type, transaction.amount, txHash || null, transaction.status, new Date(`${transaction.date}T00:00:00.000Z`)]);
            return transaction;
        }
        const user = this.users.find((entry) => entry.id === userId);
        if (user) user.transactions = [transaction, ...(user.transactions || [])];
        this.persist();
        return transaction;
    }
}

Database.initialize();

export default Database;
