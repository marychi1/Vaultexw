import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface BackendConfig {
    port: number;
    jwtSecret: string;
    encryptionKey: string;
    nodeEnv: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    supabaseEnabled: boolean;
    databaseDriver: 'file' | 'postgres';
    databaseUrl?: string;
    postgresEnabled: boolean;
    corsOrigins: string[];
    otpProvider: 'console' | 'twilio';
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromPhone?: string;
    columnApiKey?: string;
    columnBaseUrl: string;
    columnWebhookSecret?: string;
    columnWebhookEndpointId?: string;
    columnEnabled: boolean;
    columnLiveWiresEnabled: boolean;
}

export function getBackendConfig(): BackendConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';

    const port = Number(process.env.PORT || 3000);
    const jwtSecret = process.env.JWT_SECRET || (nodeEnv === 'production' ? '' : `${nodeEnv}-vaultex-jwt-secret`);
    const encryptionKey = process.env.ENCRYPTION_KEY || (nodeEnv === 'production' ? '' : 'vaultex-default-encryption-key-32B');
    const supabaseUrl = process.env.SUPABASE_URL?.trim() || undefined;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim() || undefined;
    const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

    const requestedDatabaseDriver = (process.env.DATABASE_DRIVER || 'file').toLowerCase();
    const databaseDriver = nodeEnv === 'test'
        ? 'file'
        : requestedDatabaseDriver === 'postgres' ? 'postgres' : 'file';
    const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;
    const postgresEnabled = databaseDriver === 'postgres' && Boolean(databaseUrl);
    const configuredCorsOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean)
        ?? (nodeEnv === 'production' ? [] : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']);
    const productionCorsOrigins = nodeEnv === 'production'
        ? ['https://vaultexwallet.io', 'https://www.vaultexwallet.io']
        : [];
    const corsOrigins = [...new Set([...configuredCorsOrigins, ...productionCorsOrigins])];
    const otpProvider = (process.env.OTP_PROVIDER || 'console').toLowerCase() === 'twilio' ? 'twilio' : 'console';
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || undefined;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN?.trim() || undefined;
    const twilioFromPhone = process.env.TWILIO_FROM_PHONE?.trim() || undefined;
    const columnApiKey = process.env.COLUMN_API_KEY?.trim() || undefined;
    const columnBaseUrl = process.env.COLUMN_BASE_URL?.trim() || 'https://api.column.com';
    const columnWebhookSecret = process.env.COLUMN_WEBHOOK_SECRET?.trim() || undefined;
    const columnWebhookEndpointId = process.env.COLUMN_WEBHOOK_ENDPOINT_ID?.trim() || undefined;
    const columnEnabled = process.env.COLUMN_ENABLED === 'true' && Boolean(columnApiKey);
    const liveWireOwnershipControlsImplemented = false;
    const columnLiveWiresEnabled =
        liveWireOwnershipControlsImplemented &&
        process.env.COLUMN_LIVE_WIRES_ENABLED === 'true' && nodeEnv === 'production';

    return {
        port,
        jwtSecret,
        encryptionKey,
        nodeEnv,
        supabaseUrl,
        supabaseAnonKey,
        supabaseEnabled,
        databaseDriver,
        databaseUrl,
        postgresEnabled,
        corsOrigins,
        otpProvider,
        twilioAccountSid,
        twilioAuthToken,
        twilioFromPhone,
        columnApiKey,
        columnBaseUrl,
        columnWebhookSecret,
        columnWebhookEndpointId,
        columnEnabled,
        columnLiveWiresEnabled,
    };
}

export function getProductionConfigErrors(config = getBackendConfig()): string[] {
    if (config.nodeEnv !== 'production') return [];

    const errors: string[] = [];
    if (config.jwtSecret.length < 64 || config.jwtSecret.includes('change-this')) {
        errors.push('JWT_SECRET must be a strong production secret (at least 64 characters)');
    }
    if (config.encryptionKey.length < 32 || config.encryptionKey.includes('vaultex-default')) {
        errors.push('ENCRYPTION_KEY must be configured as a strong production secret (at least 32 characters)');
    }
    if (!config.postgresEnabled) errors.push('DATABASE_DRIVER=postgres and DATABASE_URL are required');
    if (config.corsOrigins.length === 0) errors.push('CORS_ORIGIN is required');
    if (config.otpProvider === 'twilio' && (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioFromPhone)) {
        errors.push('Twilio OTP configuration is required');
    }
    if (config.columnEnabled && (!config.columnApiKey || !config.columnWebhookSecret || !config.columnWebhookEndpointId)) {
        errors.push('Column API, webhook secret, and endpoint ID are required when Column is enabled');
    }
    if (config.columnLiveWiresEnabled && (!config.columnEnabled || !config.postgresEnabled)) {
        errors.push('Live Column wires require Column and PostgreSQL to be enabled');
    }

    return errors;
}
