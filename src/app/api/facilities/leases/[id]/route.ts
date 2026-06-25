import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeLease } from '@/lib/facilities/serialize';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.landlordName === 'string' && body.landlordName.trim()) {
    data.landlordName = body.landlordName.trim();
  }
  if (typeof body.reference === 'string') data.reference = body.reference.trim() || null;
  if (typeof body.startDate === 'string' && body.startDate.trim()) {
    data.startDate = new Date(body.startDate);
  }
  if (typeof body.endDate === 'string' && body.endDate.trim()) {
    data.endDate = new Date(body.endDate);
  }
  if (typeof body.monthlyRent === 'number' && Number.isFinite(body.monthlyRent)) {
    data.monthlyRent = body.monthlyRent;
  }
  if (typeof body.renewalNotes === 'string') data.renewalNotes = body.renewalNotes.trim() || null;
  if (
    typeof body.status === 'string' &&
    ['active', 'expiring_soon', 'expired', 'terminated'].includes(body.status)
  ) {
    data.status = body.status;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const existing = await prisma.facilityLease.findFirst({
      where: { id, site: { outsourcingClientId: clientId } },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.facilityLease.update({
      where: { id },
      data,
      include: {
        site: { select: { id: true, siteCode: true, name: true } },
      },
    });

    return NextResponse.json({ lease: serializeLease(updated) });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/facilities/leases/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update lease.' }, { status: 500 });
  }
}
