import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeLease, serializeSite, serializeTicket } from '@/lib/facilities/serialize';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const row = await prisma.facilitySite.findFirst({
      where: { id, outsourcingClientId: clientId },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        leases: { orderBy: { endDate: 'asc' } },
        maintenanceTickets: {
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
          take: 20,
          include: {
            assignee: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { leases: true, maintenanceTickets: true } },
      },
    });

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      site: serializeSite(row),
      leases: row.leases.map((l) => serializeLease({ ...l, site: row })),
      tickets: row.maintenanceTickets.map((t) => serializeTicket({ ...t, site: row })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/facilities/sites/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load site.' }, { status: 500 });
  }
}

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
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (typeof body.address === 'string') data.address = body.address.trim() || null;
  if (typeof body.county === 'string') data.county = body.county.trim() || null;
  if (typeof body.phone === 'string') data.phone = body.phone.trim() || null;
  if (typeof body.notes === 'string') data.notes = body.notes.trim() || null;
  if (
    typeof body.siteType === 'string' &&
    ['office', 'warehouse', 'retail', 'site', 'other'].includes(body.siteType)
  ) {
    data.siteType = body.siteType;
  }
  if (typeof body.status === 'string' && ['active', 'inactive'].includes(body.status)) {
    data.status = body.status;
  }
  if (typeof body.managerUserId === 'string') {
    data.managerUserId = body.managerUserId.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const existing = await prisma.facilitySite.findFirst({
      where: { id, outsourcingClientId: clientId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.facilitySite.update({
      where: { id },
      data,
      include: {
        manager: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { leases: true, maintenanceTickets: true } },
      },
    });

    return NextResponse.json({ site: serializeSite(updated) });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/facilities/sites/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update site.' }, { status: 500 });
  }
}
