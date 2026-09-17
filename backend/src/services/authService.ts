import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import Database from './database';
import { User, Device, AuthToken, LoginNotification } from '../models/types';
import AuditService from './auditService';
import BlockchainService from './blockchainService';
import CryptoService from './cryptoService';
import { getBackendConfig } from '../config';

const JWT_SECRET = getBackendConfig().jwtSecret;
const JWT_EXPIRY = '24h';

class AuthService {
    static generateAuthToken(userId: string, deviceId: string): string {
        const token = jwt.sign({ userId, deviceId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        return token;
    }

    static verifyAuthToken(token: string): { userId: string; deviceId: string } | null {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; deviceId: string };
            return decoded;
        } catch {
            return null;
        }
    }

    static async hashPIN(pin: string): Promise<string> {
        const salt = await bcryptjs.genSalt(10);
        return await bcryptjs.hash(pin, salt);
    }

    static async verifyPIN(pin: string, hashedPin: string): Promise<boolean> {
        return await bcryptjs.compare(pin, hashedPin);
    }

    static async registerUser(phone: string, pin: string, walletAddress?: string, encryptedPrivateKey?: string): Promise<User> {
        const existingUser = await Database.getUserByPhone(phone);
        if (existingUser) {
            throw new Error('User already registered');
        }

        const generatedWallet = walletAddress && encryptedPrivateKey ? { walletAddress, encryptedPrivateKey } : BlockchainService.generateWallet();
        const user: User = {
            id: uuidv4(),
            phone,
            pinHash: pin, // Will be hashed before storing
            walletAddress: generatedWallet.walletAddress,
            encryptedPrivateKey: CryptoService.encrypt(generatedWallet.encryptedPrivateKey),
            verified: true,
            createdAt: new Date(),
            balance: 0,
            transactions: [],
        };

        return Database.createUser(user);
    }

    static async authenticateUser(phone: string, pin: string, deviceId: string, deviceName: string, ipAddress: string, userAgent: string): Promise<{ user: User; token: string; device: Device }> {
        const user = await Database.getUserByPhone(phone);
        if (!user) {
            throw new Error('User not found');
        }

        // Check for lockout
        const now = new Date();
        if (user.pinLockedUntil && user.pinLockedUntil > now) {
            throw new Error('PIN locked. Try later');
        }

        const pinMatches = await this.verifyPIN(pin, user.pinHash);
        if (!pinMatches) {
            // increment failed attempts
            const attempts = (user.pinFailedAttempts || 0) + 1;
            const updates: Partial<User> = { pinFailedAttempts: attempts };
            // lock account if threshold reached
            const THRESHOLD = parseInt(process.env.PIN_FAIL_THRESHOLD || '5', 10);
            const LOCK_MINUTES = parseInt(process.env.PIN_FAIL_LOCK_MINUTES || '15', 10);
            if (attempts >= THRESHOLD) {
                updates.pinLockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
            }
            await Database.updateUser(user.id, updates);
            throw new Error('Invalid PIN');
        }

        // reset failed attempts on success
        if (user.pinFailedAttempts && user.pinFailedAttempts > 0) {
            await Database.updateUser(user.id, { pinFailedAttempts: 0, pinLockedUntil: null });
        }

        // Get or create device
        let device = await Database.getDeviceById(deviceId);
        if (!device) {
            device = {
                id: deviceId,
                userId: user.id,
                deviceId,
                deviceName,
                ipAddress,
                userAgent,
                authorized: true,
                lastActivity: new Date(),
                createdAt: new Date(),
            };
            await Database.createDevice(device);
        } else {
            if (!device.authorized) {
                throw new Error('Device access revoked');
            }
            await Database.updateDevice(deviceId, {
                lastActivity: new Date(),
            });
        }

        // Generate auth token
        const token = this.generateAuthToken(user.id, deviceId);

        // Audit log
        AuditService.logEvent('user_login', { userId: user.id, deviceId, ipAddress, userAgent });

        // Login notification
        await Database.createNotification({
            id: uuidv4(),
            userId: user.id,
            deviceId,
            deviceName,
            ipAddress,
            timestamp: new Date(),
            read: false,
        });

        // Update user's last login
        await Database.updateUser(user.id, {
            lastLogin: new Date(),
        });

        return { user, token, device };
    }

    static async authenticateUserByPhone(phone: string, deviceId: string, deviceName: string, ipAddress: string, userAgent: string): Promise<{ user: User; token: string; device: Device }> {
        const user = await Database.getUserByPhone(phone);
        if (!user) {
            throw new Error('User not found');
        }

        let device = await Database.getDeviceById(deviceId);
        if (!device) {
            device = {
                id: deviceId,
                userId: user.id,
                deviceId,
                deviceName,
                ipAddress,
                userAgent,
                authorized: true,
                lastActivity: new Date(),
                createdAt: new Date(),
            };
            await Database.createDevice(device);
        } else {
            if (!device.authorized) {
                throw new Error('Device access revoked');
            }
            await Database.updateDevice(deviceId, { lastActivity: new Date() });
        }

        const token = this.generateAuthToken(user.id, deviceId);
        AuditService.logEvent('webauthn_login', { userId: user.id, deviceId, ipAddress, userAgent });

        await Database.createNotification({
            id: uuidv4(),
            userId: user.id,
            deviceId,
            deviceName,
            ipAddress,
            timestamp: new Date(),
            read: false,
        });

        await Database.updateUser(user.id, { lastLogin: new Date() });

        return { user, token, device };
    }
}

export default AuthService;
