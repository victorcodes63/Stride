import type { FleetTripDocumentType } from '@prisma/client';

export const FLEET_TRIP_DOCUMENT_TYPES: FleetTripDocumentType[] = [
  'delivery_note',
  'transport_permit',
  'pod',
  'other',
];

export const FLEET_TRIP_DOCUMENT_LABELS: Record<FleetTripDocumentType, string> = {
  delivery_note: 'Delivery note',
  transport_permit: 'Transport permit',
  pod: 'Proof of delivery (POD)',
  other: 'Other',
};
