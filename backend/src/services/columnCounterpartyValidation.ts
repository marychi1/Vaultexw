import crypto from 'crypto';
import type { CreateCounterpartyInput } from './columnService';

export function parseCustomerCounterpartyInput(body: unknown): CreateCounterpartyInput | null {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const input = body as Record<string, unknown>;
    const address = input.address;
    if (!address || typeof address !== 'object' || Array.isArray(address)) return null;

    const value = address as Record<string, unknown>;
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const accountNumber = typeof input.accountNumber === 'string' ? input.accountNumber.trim() : '';
    const accountType = input.accountType;
    const routingNumber = typeof input.routingNumber === 'string' ? input.routingNumber.trim() : '';
    const line1 = typeof value.line1 === 'string' ? value.line1.trim() : '';
    const line2 = typeof value.line2 === 'string' ? value.line2.trim() : '';
    const city = typeof value.city === 'string' ? value.city.trim() : '';
    const state = typeof value.state === 'string' ? value.state.trim().toUpperCase() : '';
    const postalCode = typeof value.postalCode === 'string' ? value.postalCode.trim() : '';
    const fields = [name, accountNumber, routingNumber, line1, line2, city, state, postalCode];
    const hasControlCharacters = fields.some((field) => /[\u0000-\u001F\u007F]/.test(field));
    const routingDigits = routingNumber.split('').map(Number);
    const routingChecksum = routingDigits.reduce(
        (sum, digit, index) => sum + digit * [3, 7, 1][index % 3],
        0
    );

    if (
        hasControlCharacters ||
        !name || name.length > 127 ||
        !/^\d{4,17}$/.test(accountNumber) ||
        (accountType !== 'checking' && accountType !== 'savings') ||
        !/^\d{9}$/.test(routingNumber) || routingChecksum % 10 !== 0 ||
        !line1 || line1.length > 35 ||
        line2.length > 35 ||
        !city || city.length > 35 ||
        !/^[A-Z]{2}$/.test(state) ||
        !/^\d{5}(?:-\d{4})?$/.test(postalCode)
    ) {
        return null;
    }

    return {
        name,
        account_number: accountNumber,
        account_type: accountType,
        routing_number: routingNumber,
        routing_number_type: 'aba',
        address: {
            line_1: line1,
            ...(line2 ? { line_2: line2 } : {}),
            city,
            state,
            postal_code: postalCode,
            country_code: 'US',
        },
    };
}

export function isVerifiedColumnCounterparty(
    counterparty: Record<string, unknown>,
    input: CreateCounterpartyInput
): counterparty is Record<string, unknown> & { id: string } {
    return typeof counterparty.id === 'string' &&
        counterparty.id.length > 0 &&
        counterparty.name === input.name &&
        counterparty.account_number === input.account_number &&
        counterparty.routing_number === input.routing_number &&
        (counterparty.account_type === undefined || counterparty.account_type === input.account_type);
}

export function isVerifiedPlatformBankAccount(
    bankAccount: Record<string, unknown>,
    bankAccountId: string,
    platformEntityId: string
): boolean {
    return bankAccount.id === bankAccountId &&
        bankAccount.status === 'open' &&
        bankAccount.currency_code === 'USD' &&
        Array.isArray(bankAccount.owners) &&
        bankAccount.owners.includes(platformEntityId);
}

export function getCustomerCounterpartyFingerprint(
    input: CreateCounterpartyInput,
    secret: string
): string {
    return crypto.createHmac('sha256', secret)
        .update(JSON.stringify(input))
        .digest('hex');
}
