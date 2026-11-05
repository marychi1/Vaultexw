import {
    getCustomerCounterpartyFingerprint,
    isVerifiedColumnCounterparty,
    isVerifiedPlatformBankAccount,
    parseCustomerCounterpartyInput,
} from '../src/services/columnCounterpartyValidation';
import ColumnService from '../src/services/columnService';

const validInput = {
    name: 'Sandbox Recipient',
    accountType: 'checking',
    accountNumber: '12345678',
    routingNumber: '000000000',
    address: {
        line1: '10 Test Street',
        line2: 'Suite 2',
        city: 'Testville',
        state: 'CA',
        postalCode: '90210',
    },
};

describe('customer Column counterparty validation', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
        jest.restoreAllMocks();
    });

    test('normalizes valid US checking account details for Column', () => {
        expect(parseCustomerCounterpartyInput(validInput)).toEqual({
            name: 'Sandbox Recipient',
            account_number: '12345678',
            account_type: 'checking',
            routing_number: '000000000',
            routing_number_type: 'aba',
            address: {
                line_1: '10 Test Street',
                line_2: 'Suite 2',
                city: 'Testville',
                state: 'CA',
                postal_code: '90210',
                country_code: 'US',
            },
        });
    });

    test.each([
        [{ ...validInput, routingNumber: '123456781' }, 'routing checksum'],
        [{ ...validInput, accountType: 'loan' }, 'unsupported account type'],
        [{ ...validInput, accountNumber: '123' }, 'short account number'],
        [{ ...validInput, address: { ...validInput.address, state: 'California' } }, 'invalid state'],
        [{ ...validInput, name: 'Recipient\nInjected' }, 'control characters'],
    ])('rejects %s (%s)', (input) => {
        expect(parseCustomerCounterpartyInput(input)).toBeNull();
    });

    test('verifies provider identity and bank details before activation', () => {
        const input = parseCustomerCounterpartyInput(validInput);
        expect(input).not.toBeNull();
        if (!input) return;

        expect(isVerifiedColumnCounterparty({
            id: 'cpty_sandbox123',
            name: input.name,
            account_number: input.account_number,
            routing_number: input.routing_number,
            account_type: input.account_type,
        }, input)).toBe(true);

        expect(isVerifiedColumnCounterparty({
            id: 'cpty_sandbox123',
            name: input.name,
            account_number: '87654321',
            routing_number: input.routing_number,
            account_type: input.account_type,
        }, input)).toBe(false);
    });

    test('fingerprints beneficiary details without storing plaintext account data', () => {
        const input = parseCustomerCounterpartyInput(validInput);
        expect(input).not.toBeNull();
        if (!input) return;

        const fingerprint = getCustomerCounterpartyFingerprint(input, 'stable-test-key');
        expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
        expect(getCustomerCounterpartyFingerprint(input, 'stable-test-key')).toBe(fingerprint);
        expect(getCustomerCounterpartyFingerprint(input, 'different-key')).not.toBe(fingerprint);
        expect(fingerprint).not.toContain(input.account_number);
    });

    test('accepts only the configured open USD platform-owned bank account', () => {
        const validAccount = {
            id: 'bank_account_123',
            status: 'open',
            currency_code: 'USD',
            owners: ['entity_platform'],
        };
        expect(isVerifiedPlatformBankAccount(validAccount, 'bank_account_123', 'entity_platform')).toBe(true);
        expect(isVerifiedPlatformBankAccount(
            { ...validAccount, status: 'frozen' },
            'bank_account_123',
            'entity_platform'
        )).toBe(false);
        expect(isVerifiedPlatformBankAccount(
            { ...validAccount, currency_code: 'EUR' },
            'bank_account_123',
            'entity_platform'
        )).toBe(false);
        expect(isVerifiedPlatformBankAccount(
            { ...validAccount, owners: ['entity_customer'] },
            'bank_account_123',
            'entity_platform'
        )).toBe(false);
        expect(isVerifiedPlatformBankAccount(validAccount, 'bank_account_other', 'entity_platform')).toBe(false);
    });

    test('retrieves the configured account through the mocked Column API', async () => {
        process.env.NODE_ENV = 'development';
        process.env.COLUMN_ENABLED = 'true';
        process.env.COLUMN_API_KEY = 'test_sandbox_key';
        const bankAccount = {
            id: 'bank_account_123',
            status: 'open',
            currency_code: 'USD',
            owners: ['entity_platform'],
        };
        const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => bankAccount,
        } as Response);

        await expect(ColumnService.getBankAccount('bank_account_123')).resolves.toEqual(bankAccount);
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.column.com/bank-accounts/bank_account_123',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: `Basic ${Buffer.from(':test_sandbox_key').toString('base64')}`,
                }),
            }),
        );
    });
});
