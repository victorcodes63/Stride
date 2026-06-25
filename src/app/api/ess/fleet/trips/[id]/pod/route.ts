import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { getFleetDriverForEmployee } from '@/lib/ess-fleet';
import { fleetTripDetailInclude, tripToDetail } from '@/lib/fleet-api';
import {
  FleetDocumentUploadError,
  uploadFleetTripDocument,
} from '@/lib/fleet-trip-document-upload';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) {
    return NextResponse.json({ error: 'No linked employee profile.' }, { status: 400 });
  }

  const driver = await getFleetDriverForEmployee(prisma, user.employeeId);
  if (!driver) {
    return NextResponse.json({ error: 'You are not registered as a fleet driver.' }, { status: 403 });
  }

  const { id } = await params;
  const trip = await prisma.fleetTrip.findFirst({
    where: {
      id,
      driverId: driver.id,
      outsourcingClientId: driver.outsourcingClientId,
    },
  });
  if (!trip) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });

  const form = await request.formData();
  const file = form.get('file');
  const title = form.get('title')?.toString().trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400 });
  }

  try {
    const uploaded = await uploadFleetTripDocument(file);
    const docTitle = title || uploaded.fileName;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.fleetTripDocument.create({
        data: {
          organizationId: trip.organizationId,
          tripId: id,
          docType: 'pod',
          title: docTitle,
          fileUrl: uploaded.url,
          fileName: uploaded.fileName,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
          uploadedByUserId: null,
        },
      });

      await tx.fleetTripEvent.create({
        data: {
          tripId: id,
          eventType: 'pod_uploaded',
          message: 'Proof of delivery uploaded by driver.',
          metadata: { fileName: uploaded.fileName, actorEmail: user.email, source: 'ess' },
        },
      });

      return tx.fleetTrip.findFirst({
        where: { id },
        include: fleetTripDetailInclude,
      });
    });

    if (!updated) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
    return NextResponse.json(tripToDetail(updated));
  } catch (e) {
    if (e instanceof FleetDocumentUploadError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
