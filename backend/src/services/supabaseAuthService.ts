import { getBackendConfig } from '../config';

export interface SupabaseCustomer {
    id: string;
    email?: string;
    emailConfirmedAt?: string;
}

class SupabaseAuthService {
    static async getCustomer(accessToken: string): Promise<SupabaseCustomer | null> {
        const config = getBackendConfig();
        if (!config.supabaseEnabled || !config.supabaseUrl || !config.supabaseAnonKey) {
            throw new Error('Supabase authentication is not configured');
        }

        const response = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
            headers: {
                apikey: config.supabaseAnonKey,
                authorization: `Bearer ${accessToken}`,
            },
        });
        if (!response.ok) return null;

        const user: unknown = await response.json();
        if (!user || typeof user !== 'object') return null;
        const record = user as Record<string, unknown>;
        if (typeof record.id !== 'string' || typeof record.email !== 'string') return null;

        return {
            id: record.id,
            email: record.email,
            emailConfirmedAt: typeof record.email_confirmed_at === 'string'
                ? record.email_confirmed_at
                : undefined,
        };
    }
}

export default SupabaseAuthService;
