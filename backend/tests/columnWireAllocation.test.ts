import {
    calculateColumnWireAllocation,
    getColumnWireLegIdempotencyKey,
    getColumnWireSplitReference,
    getColumnWireSplitStatus,
} from '../src/services/columnWireAllocation';

describe('Column wire allocation', () => {
    test('splits a gross amount into 20% reserve and the remaining recipient payout', () => {
        expect(calculateColumnWireAllocation(5_000_000)).toEqual({
            grossAmountCents: 5_000_000,
            reserveAmountCents: 1_000_000,
            recipientAmountCents: 4_000_000,
        });
    });

    test('keeps the total exact when one cent cannot be divided proportionally', () => {
        expect(calculateColumnWireAllocation(101)).toEqual({
            grossAmountCents: 101,
            reserveAmountCents: 20,
            recipientAmountCents: 81,
        });
    });

    test.each([0, -1, 1, Number.MAX_SAFE_INTEGER + 1, 1.5])(
        'rejects invalid or too-small gross amounts (%s cents)',
        (amount) => {
            expect(() => calculateColumnWireAllocation(amount)).toThrow();
        }
    );

    test('derives distinct stable Column idempotency keys for each leg', () => {
        const reserveKey = getColumnWireLegIdempotencyKey('user-1', 'request-key-123456', 'reserve');
        const recipientKey = getColumnWireLegIdempotencyKey('user-1', 'request-key-123456', 'recipient');
        const anotherUserKey = getColumnWireLegIdempotencyKey('user-2', 'request-key-123456', 'reserve');

        expect(reserveKey).toHaveLength(64);
        expect(recipientKey).toHaveLength(64);
        expect(reserveKey).not.toBe(recipientKey);
        expect(reserveKey).not.toBe(anotherUserKey);
        expect(getColumnWireLegIdempotencyKey('user-1', 'request-key-123456', 'reserve')).toBe(reserveKey);
        const splitReference = getColumnWireSplitReference('user-1', 'request-key-123456');
        expect(splitReference).toMatch(/^VTX-SPLIT-[A-F0-9]{16}$/);
        expect(getColumnWireSplitReference('user-1', 'request-key-123456')).toBe(splitReference);
        expect(getColumnWireSplitReference('user-2', 'request-key-123456')).not.toBe(splitReference);
    });

    test('reports complete, partial, processing, unresolved, and failed split outcomes', () => {
        expect(getColumnWireSplitStatus(['COMPLETED', 'COMPLETED'])).toBe('COMPLETED');
        expect(getColumnWireSplitStatus(['COMPLETED', 'REJECTED'])).toBe('PARTIAL');
        expect(getColumnWireSplitStatus(['INITIATED', 'HOLD'])).toBe('PROCESSING');
        expect(getColumnWireSplitStatus(['SUBMISSION_IN_PROGRESS', 'SUBMISSION_UNKNOWN'])).toBe('SUBMISSION_UNKNOWN');
        expect(getColumnWireSplitStatus(['COMPLETED', 'UNRECOGNIZED'])).toBe('SUBMISSION_UNKNOWN');
        expect(getColumnWireSplitStatus(['REJECTED', 'CANCELED'])).toBe('FAILED');
        expect(() => getColumnWireSplitStatus(['COMPLETED'])).toThrow();
    });
});
