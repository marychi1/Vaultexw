export interface WalletTransaction {
    id: string;
    type: 'deposit' | 'transfer' | 'withdrawal';
    amount: number;
    date: string;
    status: 'completed' | 'pending' | 'failed';
}

export interface User {
    id: string;
    phone: string;
    pinHash: string; // Hashed PIN
    walletAddress: string;
    encryptedPrivateKey: string; // Encrypted private key
    verified: boolean;
    createdAt: Date;
    balance: number;
    transactions: WalletTransaction[];
    lastLogin?: Date;
    // Security fields
    pinFailedAttempts?: number;
    pinLockedUntil?: Date | null;
}

export interface Device {
    id: string;
    userId: string;
    deviceId: string;
    deviceName: string;
    ipAddress: string;
    userAgent: string;
    authorized: boolean;
    lastActivity: Date;
    createdAt: Date;
}

export interface OTP {
    id: string;
    phone: string;
    code: string;
    expiresAt: Date;
    attempts: number;
    createdAt: Date;
}

export interface AuthToken {
    userId: string;
    deviceId: string;
    token: string;
    expiresAt: Date;
}

export interface LoginNotification {
    id: string;
    userId: string;
    deviceId: string;
    deviceName: string;
    ipAddress: string;
    timestamp: Date;
    read: boolean;
}
