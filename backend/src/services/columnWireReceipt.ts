import type { ColumnWireTransferRecord } from './database';

export function toColumnWireReceipt(transfer: ColumnWireTransferRecord, status = transfer.status) {
    return {
        reference: transfer.reference,
        status: status.toUpperCase(),
        amount: transfer.amountCents / 100,
        currencyCode: transfer.currencyCode,
        recipient: { name: transfer.recipientName },
        recipientNameVerified: false,
        paymentRail: 'wire' as const,
        submittedAt: transfer.createdAt.toISOString(),
        updatedAt: transfer.updatedAt.toISOString(),
        recipientBankConfirmed: false,
        statusNote: 'Recipient name was supplied with the payment request. Payment provider status does not confirm the recipient bank has posted the funds.',
    };
}
