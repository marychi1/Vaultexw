import { ColumnWireTransferRecord } from '../src/services/database';
import { toColumnWireReceipt } from '../src/services/columnWireReceipt';

describe('Column wire receipt', () => {
    test('returns only recipient-safe receipt details', () => {
        const transfer: ColumnWireTransferRecord = {
            idempotencyKey: 'secret-idempotency-key',
            reference: 'VTX-1A2B3C4D',
            userId: 'internal-user-id',
            transferId: 'wire_internal_provider_id',
            amountCents: 12550,
            currencyCode: 'USD',
            recipientName: 'Example Recipient',
            bankAccountId: 'bacc_internal',
            counterpartyId: 'cpty_internal',
            description: 'Invoice payment',
            status: 'COMPLETED',
            lastErrorCode: null,
            createdAt: new Date('2026-10-31T12:00:00.000Z'),
            updatedAt: new Date('2026-10-31T12:01:00.000Z'),
            lastReconciledAt: null,
        };

        const receipt = toColumnWireReceipt(transfer);

        expect(receipt).toEqual({
            reference: 'VTX-1A2B3C4D',
            status: 'COMPLETED',
            amount: 125.5,
            currencyCode: 'USD',
            recipient: { name: 'Example Recipient' },
            recipientNameVerified: false,
            paymentRail: 'wire',
            submittedAt: '2026-10-31T12:00:00.000Z',
            updatedAt: '2026-10-31T12:01:00.000Z',
            recipientBankConfirmed: false,
            statusNote: 'Recipient name was supplied with the payment request. Payment provider status does not confirm the recipient bank has posted the funds.',
        });
        expect(JSON.stringify(receipt)).not.toMatch(/idempotency|userId|transferId|bankAccountId|counterpartyId|IMAD|OMAD/i);
    });
});
