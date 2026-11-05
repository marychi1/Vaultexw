import { createHash } from 'crypto';

export interface ColumnWireAllocation {
    grossAmountCents: number;
    reserveAmountCents: number;
    recipientAmountCents: number;
}

export function calculateColumnWireAllocation(grossAmountCents: number): ColumnWireAllocation {
    if (!Number.isSafeInteger(grossAmountCents) || grossAmountCents <= 0) {
        throw new Error('Gross amount must be a positive safe integer in cents.');
    }

    const reserveAmountCents = Math.floor(grossAmountCents / 5);
    const recipientAmountCents = grossAmountCents - reserveAmountCents;
    if (reserveAmountCents === 0 || recipientAmountCents === 0) {
        throw new Error('Gross amount is too small to split into two positive transfers.');
    }

    return { grossAmountCents, reserveAmountCents, recipientAmountCents };
}

export function getColumnWireLegIdempotencyKey(
    userId: string,
    requestKey: string,
    leg: 'reserve' | 'recipient'
): string {
    return createHash('sha256')
        .update(`${userId}:${requestKey}:${leg}`)
        .digest('hex');
}

export function getColumnWireSplitReference(userId: string, requestKey: string): string {
    const suffix = createHash('sha256')
        .update(`${userId}:${requestKey}:split`)
        .digest('hex')
        .slice(0, 16);
    return `VTX-SPLIT-${suffix.toUpperCase()}`;
}

export type ColumnWireSplitStatus =
    | 'COMPLETED'
    | 'FAILED'
    | 'PARTIAL'
    | 'PROCESSING'
    | 'SUBMISSION_UNKNOWN';

export function getColumnWireSplitStatus(statuses: string[]): ColumnWireSplitStatus {
    const normalized = statuses.map((status) => status.toUpperCase());
    if (normalized.length !== 2) {
        throw new Error('A wire split must contain exactly two transfer statuses.');
    }
    const completedCount = normalized.filter((status) => status === 'COMPLETED').length;
    if (completedCount === 2) return 'COMPLETED';

    const failed = ['REJECTED', 'CANCELED', 'RETURNED', 'FAILED'];
    const failedCount = normalized.filter((status) => failed.includes(status)).length;
    if (completedCount > 0 && failedCount > 0) return 'PARTIAL';
    if (failedCount === 2) return 'FAILED';
    if (failedCount > 0) return 'PARTIAL';

    const unknown = ['SUBMISSION_PENDING', 'SUBMISSION_IN_PROGRESS', 'SUBMISSION_UNKNOWN'];
    if (normalized.some((status) => unknown.includes(status))) return 'SUBMISSION_UNKNOWN';
    const processing = ['INITIATED', 'SUBMITTED', 'HOLD', 'PRE_REVIEW', 'MANUAL_REVIEW'];
    return normalized.every((status) => processing.includes(status) || status === 'COMPLETED')
        ? 'PROCESSING'
        : 'SUBMISSION_UNKNOWN';
}
