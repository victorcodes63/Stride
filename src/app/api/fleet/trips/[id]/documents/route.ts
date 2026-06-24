import { NextRequest, NextResponse } from 'next/server';
import type { FleetTripDocumentType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import { FLEET_TRIP_DOCUMENT_TYPES } from '@/lib/fleet-documents';
import {
  FleetDocumentUploadError,
  uploadFleetTripDocument,
} from '@/lib/fleet-trip-document-upload';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { id } = await params;
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const trip = await prisma.fleetTrip.findFirst({
    where: { id, outsourcingClientId: workspaceClientId },
  });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await request.formData();
  const file = form.get('file');
  const docTypeRaw = form.get('docType')?.toString() ?? 'other';
  const title = form.get('title')?.toString().trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400 });
  }
  if (!FLEET_TRIP_DOCUMENT_TYPES.includes(docTypeRaw as FleetTripDocumentType)) {
    return NextResponse.json({ error: 'Invalid document type.' }, { status: 400 });
  }
  const docType = docTypeRaw as FleetTripDocumentType;

  try {
    const uploaded = await uploadFleetTripDocument(file);
    const docTitle = title || uploaded.fileName;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.fleetTripDocument.create({
        data: {
          tripId: id,
          docType,
          title: docTitle,
          fileUrl: uploaded.url,
          fileName: uploaded.fileName,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
          uploadedByUserId: user.id,
        },
      });

      const eventMessage =
        docType === 'pod'
          ? 'Proof of delivery uploaded and attached to trip file.'
          : `${docTitle} uploaded.`;

      await tx.fleetTripEvent.create({
        data: {
          tripId: id,
          eventType: docType === 'pod' ? 'pod_uploaded' : 'document_uploaded',
          message: eventMessage,
          metadata: { docType, fileName: uploaded.fileName, actorEmail: user.email },
        },
      });

      return tx.fleetTrip.findFirst({
        where: { id },
        include: fleetTripDetailInclude,
      });
    });

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(tripToDetail(updated));
  } catch (e) {
    if (e instanceof FleetDocumentUploadError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
