import { getBackendConfig } from '../config';

export type ColumnTransfer = Record<string, unknown>;

export type CreateWireInput = {
    amount: number;
    currencyCode: string;
    bankAccountId: string;
    counterpartyId: string;
    description?: string;
    idempotencyKey: string;
};

export type CreateCounterpartyInput = {
    name: string;
    account_number: string;
    account_type: 'checking' | 'savings';
    routing_number: string;
    routing_number_type: 'aba';
    address: {
        line_1: string;
        line_2?: string;
        city: string;
        state: string;
        postal_code: string;
        country_code: 'US';
    };
};

class ColumnService {
    static async getBankAccount(bankAccountId: string): Promise<ColumnTransfer> {
        const config = getBackendConfig();
        if (!config.columnEnabled || !config.columnApiKey) {
            throw new Error('Column integration is disabled');
        }

        const credentials = Buffer.from(`:${config.columnApiKey}`).toString('base64');
        const response = await fetch(
            `${config.columnBaseUrl}/bank-accounts/${encodeURIComponent(bankAccountId)}`,
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Basic ${credentials}`,
                },
                signal: AbortSignal.timeout(10_000),
            }
        );

        const body = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(`Column bank account lookup failed (${response.status})`);
        }
        if (!body || typeof body !== 'object') {
            throw new Error('Column returned an invalid bank account response');
        }

        return body as ColumnTransfer;
    }

    static async getCounterparty(counterpartyId: string): Promise<ColumnTransfer> {
        const config = getBackendConfig();
        if (!config.columnEnabled || !config.columnApiKey) {
            throw new Error('Column integration is disabled');
        }

        const credentials = Buffer.from(`:${config.columnApiKey}`).toString('base64');
        const response = await fetch(
            `${config.columnBaseUrl}/counterparties/${encodeURIComponent(counterpartyId)}`,
            {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Basic ${credentials}`,
                },
                signal: AbortSignal.timeout(10_000),
            }
        );

        const body = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(`Column counterparty lookup failed (${response.status})`);
        }
        if (!body || typeof body !== 'object') {
            throw new Error('Column returned an invalid counterparty response');
        }

        return body as ColumnTransfer;
    }

    static async createCounterparty(input: CreateCounterpartyInput): Promise<ColumnTransfer> {
        const config = getBackendConfig();
        if (!config.columnEnabled || !config.columnApiKey) {
            throw new Error('Column integration is disabled');
        }

        const credentials = Buffer.from(`:${config.columnApiKey}`).toString('base64');
        const response = await fetch(`${config.columnBaseUrl}/counterparties`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(input),
            signal: AbortSignal.timeout(10_000),
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(`Column counterparty creation failed (${response.status})`);
        }
        if (!body || typeof body !== 'object') {
            throw new Error('Column returned an invalid counterparty response');
        }

        return body as ColumnTransfer;
    }

    static async getTransfer(transferId: string): Promise<ColumnTransfer> {
        const config = getBackendConfig();
        if (!config.columnEnabled || !config.columnApiKey) {
            throw new Error('Column integration is disabled');
        }

        const credentials = Buffer.from(`:${config.columnApiKey}`).toString('base64');
        const response = await fetch(`${config.columnBaseUrl}/transfers/${encodeURIComponent(transferId)}`, {
            headers: {
                Accept: 'application/json',
                Authorization: `Basic ${credentials}`,
            },
            signal: AbortSignal.timeout(10_000),
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(`Column transfer lookup failed (${response.status})`);
        }

        return body as ColumnTransfer;
    }

    static async createWire(input: CreateWireInput): Promise<ColumnTransfer> {
        const config = getBackendConfig();
        if (!config.columnEnabled || !config.columnApiKey) {
            throw new Error('Column integration is disabled');
        }

        const credentials = Buffer.from(`:${config.columnApiKey}`).toString('base64');
        const form = new URLSearchParams({
            amount: String(input.amount),
            currency_code: input.currencyCode,
            bank_account_id: input.bankAccountId,
            counterparty_id: input.counterpartyId,
        });
        if (input.description) form.set('description', input.description);

        const response = await fetch(`${config.columnBaseUrl}/transfers/wire`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Idempotency-Key': input.idempotencyKey,
            },
            body: form,
            signal: AbortSignal.timeout(10_000),
        });

        const body = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(`Column wire creation failed (${response.status})`);
        }

        return body as ColumnTransfer;
    }
}

export default ColumnService;