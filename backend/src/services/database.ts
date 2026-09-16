import fs from 'fs';
import path from 'path';
import { User, Device, OTP, LoginNotification } from '../models/types';

const DATA_FILE = path.resolve(__dirname, '../../data/vaultex-db.json');

class Database {
    private static users: User[] = [];
    private static devices: Device[] = [];
    private static otps: OTP[] = [];
    private static notifications: LoginNotification[] = [];
    private static webauthnChallenges: { phone: string; challenge: string; createdAt: Date }[] = [];
    private static credentials: { phone: string; credentialId: string; publicKey: string; counter: number }[] = [];

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
        } catch {
            this.users = [];
            this.devices = [];
            this.otps = [];
            this.notifications = [];
            this.webauthnChallenges = [];
            this.credentials = [];
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
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2));
    }

    static resetAll() {
        this.users = [];
        this.devices = [];
        this.otps = [];
        this.notifications = [];
        this.webauthnChallenges = [];
        this.credentials = [];
        this.persist();
    }

    static initialize() {
        this.loadFromDisk();
    }

    // User operations
    static getUserByPhone(phone: string): User | undefined {
        return this.users.find((u) => u.phone === phone);
    }

    static getUserById(id: string): User | undefined {
        return this.users.find((u) => u.id === id);
    }

    static createUser(user: User): User {
        // initialize security fields
        user.pinFailedAttempts = user.pinFailedAttempts || 0;
        user.pinLockedUntil = user.pinLockedUntil || null;
        user.balance = Number(user.balance ?? 0);
        user.transactions = Array.isArray(user.transactions) ? user.transactions : [];
        this.users.push(user);
        this.persist();
        return user;
    }

    static updateUser(id: string, updates: Partial<User>): User | undefined {
        const user = this.getUserById(id);
        if (user) {
            Object.assign(user, updates);
            this.persist();
        }
        return user;
    }

    // Device operations
    static getDeviceById(id: string): Device | undefined {
        return this.devices.find((d) => d.id === id);
    }

    static getUserDevices(userId: string): Device[] {
        return this.devices.filter((d) => d.userId === userId);
    }

    static createDevice(device: Device): Device {
        this.devices.push(device);
        this.persist();
        return device;
    }

    static updateDevice(id: string, updates: Partial<Device>): Device | undefined {
        const device = this.getDeviceById(id);
        if (device) {
            Object.assign(device, updates);
            this.persist();
        }
        return device;
    }

    static revokeDevice(id: string): Device | undefined {
        const device = this.getDeviceById(id);
        if (device) {
            device.authorized = false;
            this.persist();
        }
        return device;
    }

    // OTP operations
    static getOTPByPhone(phone: string): OTP | undefined {
        return this.otps.find((o) => o.phone === phone && o.expiresAt > new Date());
    }

    static createOTP(otp: OTP): OTP {
        // Remove old OTPs for this phone
        this.otps = this.otps.filter((o) => o.phone !== otp.phone);
        this.otps.push(otp);
        this.persist();
        return otp;
    }

    static updateOTP(id: string, updates: Partial<OTP>): OTP | undefined {
        const otp = this.otps.find((o) => o.id === id);
        if (otp) {
            Object.assign(otp, updates);
            this.persist();
        }
        return otp;
    }

    // Notification operations
    static getNotifications(userId: string): LoginNotification[] {
        return this.notifications.filter((n) => n.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    static createNotification(notification: LoginNotification): LoginNotification {
        this.notifications.push(notification);
        this.persist();
        return notification;
    }

    static markNotificationAsRead(id: string): LoginNotification | undefined {
        const notification = this.notifications.find((n) => n.id === id);
        if (notification) {
            notification.read = true;
            this.persist();
        }
        return notification;
    }

    // WebAuthn challenge operations
    static createWebAuthnChallenge(phone: string, challenge: string) {
        // replace existing
        this.webauthnChallenges = this.webauthnChallenges.filter((c) => c.phone !== phone);
        const entry = { phone, challenge, createdAt: new Date() };
        this.webauthnChallenges.push(entry);
        this.persist();
        return entry;
    }

    static getWebAuthnChallenge(phone: string) {
        return this.webauthnChallenges.find((c) => c.phone === phone);
    }

    static removeWebAuthnChallenge(phone: string) {
        this.webauthnChallenges = this.webauthnChallenges.filter((c) => c.phone !== phone);
        this.persist();
    }

    // Credentials
    static storeCredential(phone: string, credentialId: string, publicKey: string, counter: number) {
        this.credentials = this.credentials.filter((c) => c.phone !== phone || c.credentialId !== credentialId);
        this.credentials.push({ phone, credentialId, publicKey, counter });
        this.persist();
    }

    static getCredentialsForPhone(phone: string) {
        return this.credentials.filter((c) => c.phone === phone);
    }

    static getCredential(phone: string, credentialId: string) {
        return this.credentials.find((c) => c.phone === phone && c.credentialId === credentialId);
    }

    static updateCredentialCounter(phone: string, credentialId: string, counter: number) {
        const credential = this.getCredential(phone, credentialId);
        if (credential) {
            credential.counter = counter;
            this.persist();
        }
    }
}

Database.initialize();

export default Database;
