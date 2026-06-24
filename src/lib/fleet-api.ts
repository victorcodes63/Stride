import type { FleetComplianceCheckType, FleetComplianceResult, FleetTripDocumentType, FleetTripStatus } from '@prisma/client';
import { FLEET_COMPLIANCE_CHECK_LABELS, FLEET_COMPLIANCE_RESULT_LABELS } from '@/lib/fleet-compliance';
import { FLEET_TRIP_DOCUMENT_LABELS } from '@/lib/fleet-documents';
import { FLEET_TRIP_STATUS_LABELS } from '@/lib/fleet-status';

export const fleetTripInclude = {
  customer: { select: { id: true, name: true } },
  vehicle: { select: { id: true, registration: true, label: true } },
  driver: { select: { id: true, fullName: true } },
  partner: { select: { id: true, name: true } },
  order: { select: { id: true, orderNumber: true } },
} as const;

export const fleetTripDetailInclude = {
  ...fleetTripInclude,
  events: { orderBy: { createdAt: 'desc' as const }, take: 50 },
  complianceChecks: {
    orderBy: { checkType: 'asc' as const },
    include: { checkedBy: { select: { name: true } } },
  },
  documents: {
    orderBy: { createdAt: 'desc' as const },
    include: { uploadedBy: { select: { name: true } } },
  },
} as const;

export type FleetTripComplianceRow = {
  id: string;
  checkType: FleetComplianceCheckType;
  checkLabel: string;
  result: FleetComplianceResult;
  resultLabel: string;
  notes: string | null;
  evidenceUrl: string | null;
  checkedAt: string | null;
  checkedByName: string | null;
};

export type FleetTripDocumentRow = {
  id: string;
  docType: FleetTripDocumentType;
  docTypeLabel: string;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  uploadedByName: string | null;
};

export type FleetTripListRow = {
  id: string;
  tripNumber: string;
  status: FleetTripStatus;
  statusLabel: string;
  origin: string;
  destination: string;
  cargoType: string | null;
  customerName: string;
  vehicleRegistration: string | null;
  driverName: string | null;
  partnerName: string | null;
  isOutsourced: boolean;
  plannedDeliveryAt: string | null;
  updatedAt: string;
};

export function tripToListRow(trip: {
  id: string;
  tripNumber: string;
  status: FleetTripStatus;
  origin: string;
  destination: string;
  cargoType: string | null;
  isOutsourced: boolean;
  plannedDeliveryAt: Date | null;
  updatedAt: Date;
  customer: { name: string };
  vehicle: { registration: string } | null;
  driver: { fullName: string } | null;
  partner: { name: string } | null;
}): FleetTripListRow {
  return {
    id: trip.id,
    tripNumber: trip.tripNumber,
    status: trip.status,
    statusLabel: FLEET_TRIP_STATUS_LABELS[trip.status],
    origin: trip.origin,
    destination: trip.destination,
    cargoType: trip.cargoType,
    customerName: trip.customer.name,
    vehicleRegistration: trip.vehicle?.registration ?? null,
    driverName: trip.driver?.fullName ?? null,
    partnerName: trip.partner?.name ?? null,
    isOutsourced: trip.isOutsourced,
    plannedDeliveryAt: trip.plannedDeliveryAt?.toISOString() ?? null,
    updatedAt: trip.updatedAt.toISOString(),
  };
}

export type FleetTripDetail = FleetTripListRow & {
  orderNumber: string | null;
  cargoWeightKg: number | null;
  plannedDistanceKm: number | null;
  actualDistanceKm: number | null;
  actualDeliveryAt: string | null;
  notes: string | null;
  createdAt: string;
  events: { id: string; eventType: string; message: string; createdAt: string }[];
  complianceChecks: FleetTripComplianceRow[];
  complianceComplete: boolean;
  documents: FleetTripDocumentRow[];
};

export function tripToDetail(trip: {
  id: string;
  tripNumber: string;
  status: FleetTripStatus;
  origin: string;
  destination: string;
  cargoType: string | null;
  cargoWeightKg: number | null;
  isOutsourced: boolean;
  plannedDistanceKm: number | null;
  actualDistanceKm: number | null;
  plannedDeliveryAt: Date | null;
  actualDeliveryAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { name: string };
  vehicle: { registration: string } | null;
  driver: { fullName: string } | null;
  partner: { name: string } | null;
  order: { orderNumber: string } | null;
  events: { id: string; eventType: string; message: string; createdAt: Date }[];
  complianceChecks?: {
    id: string;
    checkType: FleetComplianceCheckType;
    result: FleetComplianceResult;
    notes: string | null;
    evidenceUrl: string | null;
    checkedAt: Date | null;
    checkedBy: { name: string } | null;
  }[];
  documents?: {
    id: string;
    docType: FleetTripDocumentType;
    title: string;
    fileUrl: string;
    fileName: string;
    fileSize: number | null;
    mimeType: string | null;
    createdAt: Date;
    uploadedBy: { name: string } | null;
  }[];
}): FleetTripDetail {
  const complianceChecks = (trip.complianceChecks ?? []).map((c) => ({
    id: c.id,
    checkType: c.checkType,
    checkLabel: FLEET_COMPLIANCE_CHECK_LABELS[c.checkType],
    result: c.result,
    resultLabel: FLEET_COMPLIANCE_RESULT_LABELS[c.result],
    notes: c.notes,
    evidenceUrl: c.evidenceUrl,
    checkedAt: c.checkedAt?.toISOString() ?? null,
    checkedByName: c.checkedBy?.name ?? null,
  }));
  const documents = (trip.documents ?? []).map((d) => ({
    id: d.id,
    docType: d.docType,
    docTypeLabel: FLEET_TRIP_DOCUMENT_LABELS[d.docType],
    title: d.title,
    fileUrl: d.fileUrl,
    fileName: d.fileName,
    fileSize: d.fileSize,
    mimeType: d.mimeType,
    createdAt: d.createdAt.toISOString(),
    uploadedByName: d.uploadedBy?.name ?? null,
  }));

  return {
    ...tripToListRow(trip),
    orderNumber: trip.order?.orderNumber ?? null,
    cargoWeightKg: trip.cargoWeightKg,
    plannedDistanceKm: trip.plannedDistanceKm,
    actualDistanceKm: trip.actualDistanceKm,
    actualDeliveryAt: trip.actualDeliveryAt?.toISOString() ?? null,
    notes: trip.notes,
    createdAt: trip.createdAt.toISOString(),
    events: trip.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    })),
    complianceChecks,
    complianceComplete:
      complianceChecks.length > 0 &&
      complianceChecks.every((c) => c.result === 'passed' || c.result === 'waived'),
    documents,
  };
}
