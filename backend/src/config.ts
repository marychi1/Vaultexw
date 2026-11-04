import path from 'path';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const developmentJwtSecret = randomBytes(64).toString('hex');
const developmentEncryptionKey = randomBytes(32).toString('hex');

export interface BackendConfig {
    port: number;
    jwtSecret: string;
    jwtSecretConfigured: boolean;
    encryptionKey: string;
    encryptionKeyConfigured: boolean;
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
    columnCustomerCounterpartiesEnabled: boolean;
    columnWireBankAccountId?: string;
    columnPlatformEntityId?: string;
    columnSandboxWiresEnabled: boolean;
    columnLiveWiresEnabled: boolean;
}

export function getBackendConfig(): BackendConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';

    const port = Number(process.env.PORT || (nodeEnv === 'development' ? 3002 : 3000));
    const configuredJwtSecret = process.env.JWT_SECRET?.trim();
    const configuredEncryptionKey = process.env.ENCRYPTION_KEY?.trim();
    const jwtSecretConfigured = Boolean(configuredJwtSecret);
    const encryptionKeyConfigured = Boolean(configuredEncryptionKey);
    const allowsEphemeralSecrets = nodeEnv === 'development' || nodeEnv === 'test';
    const jwtSecret = configuredJwtSecret || (allowsEphemeralSecrets ? developmentJwtSecret : '');
    const encryptionKey = configuredEncryptionKey || (allowsEphemeralSecrets ? developmentEncryptionKey : '');
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
    const columnWireBankAccountId = process.env.COLUMN_WIRE_BANK_ACCOUNT_ID?.trim() || undefined;
    const columnPlatformEntityId = process.env.COLUMN_PLATFORM_ENTITY_ID?.trim() || undefined;
    const columnKeyIsValidForEnvironment = nodeEnv === 'production'
        ? Boolean(columnApiKey?.startsWith('live_'))
        : Boolean(columnApiKey?.startsWith('test_'));
    const columnBaseUrlIsValid = columnBaseUrl === 'https://api.column.com';
    const columnEnabled =
        process.env.COLUMN_ENABLED === 'true' &&
        columnKeyIsValidForEnvironment &&
        columnBaseUrlIsValid;
    const columnSandboxWiresEnabled =
        process.env.COLUMN_SANDBOX_WIRES_ENABLED === 'true' &&
        nodeEnv !== 'production' &&
        columnEnabled &&
        postgresEnabled &&
        columnBaseUrl === 'https://api.column.com' &&
        Boolean(columnApiKey?.startsWith('test_'));
    const columnCustomerCounterpartiesEnabled =
        process.env.COLUMN_CUSTOMER_COUNTERPARTIES_ENABLED === 'true' &&
        nodeEnv !== 'production' &&
        columnEnabled &&
        postgresEnabled &&
        Boolean(columnApiKey?.startsWith('test_'));
    const productionLiveWiresApproved = false;
    const columnLiveWiresEnabled =
        productionLiveWiresApproved &&
        process.env.COLUMN_LIVE_WIRES_ENABLED === 'true' &&
        nodeEnv === 'production' &&
        columnEnabled &&
        postgresEnabled;

    return {
        port,
        jwtSecret,
        jwtSecretConfigured,
        encryptionKey,
        encryptionKeyConfigured,
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
        columnCustomerCounterpartiesEnabled,
        columnWireBankAccountId,
        columnPlatformEntityId,
        columnSandboxWiresEnabled,
        columnLiveWiresEnabled,
    };
}

export function getProductionConfigErrors(config = getBackendConfig()): string[] {
    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') return [];

    const errors: string[] = [];
    if (
        !config.jwtSecretConfigured ||
        config.jwtSecret.length < 64 ||
        /replace|change-this|placeholder|example/i.test(config.jwtSecret)
    ) {
        errors.push('JWT_SECRET must be a strong production secret');
    }
    if (
        !config.encryptionKeyConfigured ||
        config.encryptionKey.length < 32 ||
        /replace|change-this|placeholder|example/i.test(config.encryptionKey)
    ) {
        errors.push('ENCRYPTION_KEY must be a configured key of at least 32 characters');
    }
    if (config.nodeEnv !== 'production') return errors;

    if (!config.postgresEnabled) errors.push('DATABASE_DRIVER=postgres and DATABASE_URL are required');
    if (config.corsOrigins.length === 0) errors.push('CORS_ORIGIN is required');
    if (config.otpProvider === 'twilio' && (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioFromPhone)) {
        errors.push('Twilio OTP configuration is required');
    }
    if (process.env.COLUMN_ENABLED === 'true' && !config.columnEnabled) {
        errors.push('Column requires the approved API URL and an environment-appropriate API key');
    }
    if (config.columnEnabled && (!config.columnWebhookSecret || !config.columnWebhookEndpointId)) {
        errors.push('Column webhook secret and endpoint ID are required when Column is enabled');
    }
    if (
        process.env.COLUMN_CUSTOMER_COUNTERPARTIES_ENABLED === 'true' &&
        !config.columnCustomerCounterpartiesEnabled
    ) {
        errors.push('Customer counterparty creation is limited to non-production environments using Column test credentials and PostgreSQL');
    }
    if (process.env.COLUMN_LIVE_WIRES_ENABLED === 'true') {
        errors.push('Live Column wires remain blocked pending production, compliance, and operational approval');
        if (!config.columnWireBankAccountId || !config.columnPlatformEntityId) {
            errors.push('COLUMN_WIRE_BANK_ACCOUNT_ID and COLUMN_PLATFORM_ENTITY_ID are required for platform-funded wires');
        }
    }

    return errors;
}
