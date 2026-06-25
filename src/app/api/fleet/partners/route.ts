import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessFleet,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) return NextResponse.json([]);

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const rows = await prisma.fleetTransportPartner.findMany({
    where: { outsourcingClientId: workspaceClientId },
    include: { _count: { select: { trips: true } } },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      payoutDetails: row.payoutDetails,
      tripCount: row._count.trips,
      notes: row.notes,
    })),
  );
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessFleet(user)) {
    return forbiddenResponse('Fleet access is restricted to operations and admin users.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required.' }, { status: 400 });
  }

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const row = await prisma.fleetTransportPartner.create({
    data: {
      organizationId: user.currentOrgId,
      outsourcingClientId: workspaceClientId,
      name,
      contactName:
        typeof body?.contactName === 'string' ? body.contactName.trim() || null : null,
      contactPhone:
        typeof body?.contactPhone === 'string' ? body.contactPhone.trim() || null : null,
      contactEmail:
        typeof body?.contactEmail === 'string' ? body.contactEmail.trim() || null : null,
      payoutDetails:
        typeof body?.payoutDetails === 'string' ? body.payoutDetails.trim() || null : null,
      notes: typeof body?.notes === 'string' ? body.notes.trim() || null : null,
    },
  });

  return NextResponse.json({ id: row.id, name: row.name }, { status: 201 });
}
