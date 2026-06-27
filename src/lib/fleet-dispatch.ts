import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { existsSync, readFileSync } from 'fs';
import type { Prisma, PrismaClient } from '@prisma/client';
import { brand, getLogoFileAbsolutePath } from '@/lib/brand';
import { uploadFleetTripDocumentBuffer } from '@/lib/fleet-trip-document-upload';
import {
  applyTripStatusChange,
  TripStatusTransitionError,
} from '@/lib/fleet-trip-status-change';

const LOGO_PATH = getLogoFileAbsolutePath();
const ADDRESS =
  brand.contactAddress ||
  'Configure NEXT_PUBLIC_CONTACT_ADDRESS for letter headers.';

export type DeliveryNoteInput = {
  tripNumber: string;
  customerName: string;
  origin: string;
  destination: string;
  cargoType: string | null;
  cargoWeightKg: number | null;
  vehicleRegistration: string | null;
  driverName: string | null;
  partnerName: string | null;
  plannedDeliveryAt: Date | null;
  plannedDistanceKm: number | null;
  dispatchedAt: string;
  dispatchedBy: string;
};

export async function generateDeliveryNotePdf(input: DeliveryNoteInput): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 790;

  if (existsSync(LOGO_PATH)) {
    const png = await doc.embedPng(readFileSync(LOGO_PATH));
    page.drawImage(png, { x: 230, y: y - 40, width: 120, height: 40 });
    y -= 52;
  }

  page.drawText(ADDRESS, { x: 60, y, size: 9, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
  y -= 28;
  page.drawText('DELIVERY NOTE', { x: 60, y, size: 16, font: bold, color: rgb(1, 0.33, 0.21) });
  y -= 24;
  page.drawText(`Trip: ${input.tripNumber}`, { x: 60, y, size: 11, font: bold });
  y -= 18;
  page.drawText(`Dispatched: ${input.dispatchedAt}`, { x: 60, y, size: 10, font: helvetica });
  y -= 16;
  page.drawText(`By: ${input.dispatchedBy}`, { x: 60, y, size: 10, font: helvetica });
  y -= 28;

  const rows: [string, string][] = [
    ['Customer', input.customerName],
    ['Origin', input.origin],
    ['Destination', input.destination],
    ['Cargo', input.cargoType ?? '—'],
    ['Weight (kg)', input.cargoWeightKg != null ? String(input.cargoWeightKg) : '—'],
    ['Vehicle', input.vehicleRegistration ?? '—'],
    ['Driver / partner', input.driverName ?? input.partnerName ?? '—'],
    [
      'Planned delivery',
      input.plannedDeliveryAt ? input.plannedDeliveryAt.toLocaleDateString('en-KE') : '—',
    ],
    ['Distance (km)', input.plannedDistanceKm != null ? String(input.plannedDistanceKm) : '—'],
  ];

  for (const [label, value] of rows) {
    page.drawText(`${label}:`, { x: 60, y, size: 10, font: bold });
    page.drawText(value, { x: 180, y, size: 10, font: helvetica });
    y -= 16;
  }

  y -= 20;
  page.drawText(
    'This delivery note confirms cargo loaded and authorised for dispatch. Receiver to sign POD on delivery.',
    { x: 60, y, size: 9, font: helvetica, maxWidth: 475, lineHeight: 12 },
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export async function dispatchFleetTrip(
  tx: Prisma.TransactionClient,
  input: {
    tripId: string;
    organizationId: string;
    actorEmail: string;
    actorUserId: string;
  },
) {
  const trip = await tx.fleetTrip.findUnique({
    where: { id: input.tripId },
    include: {
      customer: { select: { name: true } },
      vehicle: { select: { registration: true } },
      driver: { select: { fullName: true } },
      partner: { select: { name: true } },
    },
  });
  if (!trip) throw new TripStatusTransitionError('Trip not found.');

  if (trip.status !== 'loaded') {
    throw new TripStatusTransitionError(
      'Trip must be in Loaded status before dispatch.',
    );
  }

  const existingNote = await tx.fleetTripDocument.findFirst({
    where: { tripId: input.tripId, docType: 'delivery_note' },
  });
  if (!existingNote) {
    const pdf = await generateDeliveryNotePdf({
      tripNumber: trip.tripNumber,
      customerName: trip.customer.name,
      origin: trip.origin,
      destination: trip.destination,
      cargoType: trip.cargoType,
      cargoWeightKg: trip.cargoWeightKg,
      vehicleRegistration: trip.vehicle?.registration ?? null,
      driverName: trip.driver?.fullName ?? null,
      partnerName: trip.partner?.name ?? null,
      plannedDeliveryAt: trip.plannedDeliveryAt,
      plannedDistanceKm: trip.plannedDistanceKm,
      dispatchedAt: new Date().toLocaleString('en-KE'),
      dispatchedBy: input.actorEmail,
    });

    const fileName = `delivery-note-${trip.tripNumber}.pdf`;
    const uploaded = await uploadFleetTripDocumentBuffer({
      buffer: pdf,
      fileName,
      mimeType: 'application/pdf',
    });

    await tx.fleetTripDocument.create({
      data: {
        organizationId: input.organizationId,
        tripId: input.tripId,
        docType: 'delivery_note',
        title: `Delivery note — ${trip.tripNumber}`,
        fileUrl: uploaded.url,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
        mimeType: uploaded.mimeType,
        uploadedByUserId: input.actorUserId,
      },
    });
  }

  return applyTripStatusChange(tx, {
    tripId: input.tripId,
    from: 'loaded',
    to: 'in_transit',
    actor: 'staff',
    actorEmail: input.actorEmail,
    source: 'dispatch',
    note: 'Dispatched with delivery note.',
  });
}

export async function verifyFleetPod(
  prisma: PrismaClient,
  input: {
    tripId: string;
    documentId: string;
    organizationId: string;
    approved: boolean;
    actorUserId: string;
    actorEmail: string;
    rejectionReason?: string;
  },
) {
  const doc = await prisma.fleetTripDocument.findFirst({
    where: {
      id: input.documentId,
      tripId: input.tripId,
      docType: 'pod',
      organizationId: input.organizationId,
    },
  });
  if (!doc) throw new Error('POD document not found.');

  const trip = await prisma.fleetTrip.findUnique({
    where: { id: input.tripId },
    select: { status: true, tripNumber: true },
  });
  if (!trip) throw new Error('Trip not found.');

  if (!input.approved) {
    await prisma.$transaction(async (tx) => {
      await tx.fleetTripEvent.create({
        data: {
          organizationId: input.organizationId,
          tripId: input.tripId,
          eventType: 'pod_rejected',
          message: `POD rejected: ${input.rejectionReason?.trim() || 'See operations notes.'}`,
          metadata: {
            documentId: input.documentId,
            actorEmail: input.actorEmail,
          },
        },
      });
    });
    return { approved: false as const };
  }

  return prisma.$transaction(async (tx) => {
    await tx.fleetTripDocument.update({
      where: { id: input.documentId },
      data: {
        verifiedAt: new Date(),
        verifiedByUserId: input.actorUserId,
      },
    });

    await tx.fleetTripEvent.create({
      data: {
        organizationId: input.organizationId,
        tripId: input.tripId,
        eventType: 'pod_verified',
        message: `POD verified for trip ${trip.tripNumber}.`,
        metadata: {
          documentId: input.documentId,
          actorEmail: input.actorEmail,
        },
      },
    });

    const settlement = await tx.fleetSettlement.findUnique({
      where: { tripId: input.tripId },
    });
    if (settlement) {
      await tx.fleetSettlement.update({
        where: { id: settlement.id },
        data: { podVerified: true },
      });
    }

    if (trip.status === 'in_transit') {
      await applyTripStatusChange(tx, {
        tripId: input.tripId,
        from: 'in_transit',
        to: 'delivered',
        actor: 'staff',
        actorEmail: input.actorEmail,
        source: 'pod_validation',
        note: 'POD approved by operations.',
      });
    }

    return { approved: true as const };
  });
}
