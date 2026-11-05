import { getColumnWireEventStatus } from '../src/services/columnWireStatus';

describe('Column wire event status mapping', () => {
    test.each([
        ['wire.outgoing_transfer.initiated', 'INITIATED'],
        ['wire.outgoing_transfer.submitted', 'SUBMITTED'],
        ['wire.outgoing_transfer.hold_created', 'HOLD'],
        ['wire.outgoing_transfer.pre_review', 'PRE_REVIEW'],
        ['wire.outgoing_transfer.manual_review', 'MANUAL_REVIEW'],
        ['wire.outgoing_transfer.completed', 'COMPLETED'],
        ['wire.outgoing_transfer.rejected', 'REJECTED'],
        ['wire.outgoing_transfer.canceled', 'CANCELED'],
        ['wire.outgoing_transfer.returned', 'RETURNED'],
    ])('maps %s to %s', (eventType, status) => {
        expect(getColumnWireEventStatus(eventType)).toBe(status);
    });

    test('does not infer status from unknown events', () => {
        expect(getColumnWireEventStatus('wire.incoming_transfer.completed')).toBeUndefined();
    });
});
