const WIRE_EVENT_STATUSES: Record<string, string> = {
    'wire.outgoing_transfer.initiated': 'INITIATED',
    'wire.outgoing_transfer.hold_created': 'HOLD',
    'wire.outgoing_transfer.pre_review': 'PRE_REVIEW',
    'wire.outgoing_transfer.manual_review': 'MANUAL_REVIEW',
    'wire.outgoing_transfer.completed': 'COMPLETED',
    'wire.outgoing_transfer.rejected': 'REJECTED',
    'wire.outgoing_transfer.canceled': 'CANCELED',
    'wire.outgoing_transfer.returned': 'RETURNED',
};

export function getColumnWireEventStatus(eventType: string): string | undefined {
    return WIRE_EVENT_STATUSES[eventType];
}
