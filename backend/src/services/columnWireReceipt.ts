import type { ColumnWireTransferRecord } from './database';

export function toColumnWireReceipt(transfer: ColumnWireTransferRecord, status = transfer.status) {
    const providerStatus = status.toUpperCase();
    const recipientStatus =
        providerStatus === 'COMPLETED'
            ? 'RECIPIENT_POSTING_CONFIRMATION_PENDING'
            : providerStatus;

    return {
        reference: transfer.reference,
        split: transfer.splitReference ? {
            reference: transfer.splitReference,
            leg: transfer.splitLeg,
            grossAmount: transfer.grossAmountCents === null ? null : transfer.grossAmountCents / 100,
        } : undefined,
        status: recipientStatus,
        providerStatus,
        amount: transfer.amountCents / 100,
        currencyCode: transfer.currencyCode,
        recipient: { name: transfer.recipientName },
        recipientNameVerified: false,
        paymentRail: 'wire' as const,
        submittedAt: transfer.createdAt.toISOString(),
        updatedAt: transfer.updatedAt.toISOString(),
        recipientBankConfirmed: false,
        statusNote:
            providerStatus === 'COMPLETED'
                ? 'Column reports completion. Recipient bank posting has not been independently confirmed.'
                : 'Recipient bank posting has not been independently confirmed.',
    };
}
