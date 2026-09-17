import { getWallet } from '@/lib/api';

export type WalletTransaction = {
    id: string;
    type: 'deposit' | 'transfer' | 'withdrawal';
    amount: number;
    date: string;
    status: 'completed' | 'pending' | 'failed';
};

export type WalletState = {
    balance: number;
    address: string;
    phone: string;
    transactions: WalletTransaction[];
};

export const defaultWallet: WalletState = {
    balance: 0,
    address: '',
    phone: '',
    transactions: [],
};

export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('vaultex-token');
}

export function isSignedIn(): boolean {
    return Boolean(getAuthToken());
}

export function getStoredUser() {
    if (typeof window === 'undefined') return null;

    const raw = localStorage.getItem('vaultex-user');
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function createWalletTransaction(
    input: Omit<WalletTransaction, 'id' | 'date'> & { id?: string; date?: string },
): WalletTransaction {
    return {
        id: input.id ?? `0x${Math.random().toString(16).slice(2, 10)}`,
        type: input.type,
        amount: input.amount,
        date: input.date ?? new Date().toISOString().slice(0, 10),
        status: input.status,
    };
}

export function getWalletState(): WalletState {
    if (typeof window === 'undefined') return defaultWallet;

    const raw = localStorage.getItem('vaultex-wallet');
    if (!raw) return defaultWallet;

    try {
        return { ...defaultWallet, ...JSON.parse(raw) };
    } catch {
        return defaultWallet;
    }
}

export function saveWalletState(wallet: WalletState) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('vaultex-wallet', JSON.stringify(wallet));
}

export async function hydrateWalletFromBackend(): Promise<WalletState> {
    const token = getAuthToken();
    const storedUser = getStoredUser();

    if (!token) {
        return defaultWallet;
    }

    try {
        const walletData = await getWallet(token);
        const next: WalletState = {
            balance: Number(walletData.balance ?? 0),
            address: walletData.address ?? storedUser?.walletAddress ?? '',
            phone: storedUser?.phone ?? '',
            transactions: Array.isArray(walletData.transactions) ? walletData.transactions.map((tx: any) => ({
                id: tx.id ?? `tx-${Math.random().toString(16).slice(2, 10)}`,
                type: tx.type ?? 'transfer',
                amount: Number(tx.amount ?? 0),
                date: tx.date ?? new Date().toISOString().slice(0, 10),
                status: tx.status ?? 'completed',
            })) : [],
        };

        saveWalletState(next);
        return next;
    } catch {
        const existing = getWalletState();
        return existing.address ? existing : defaultWallet;
    }
}
