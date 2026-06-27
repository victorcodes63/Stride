import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeLease, serializeSite, serializeTicket } from '@/lib/facilities/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    try {
      const row = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        return tx.facilitySite.findFirst({
          where: ctx.where({ id, outsourcingClientId: clientId }),
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
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
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
      const updated = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const existing = await tx.facilitySite.findFirst({
          where: ctx.where({ id, outsourcingClientId: clientId }),
          select: { id: true },
        });
        if (!existing) return null;

        return tx.facilitySite.update({
          where: { id },
          data,
          include: {
            manager: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            _count: { select: { leases: true, maintenanceTickets: true } },
          },
        });
      });

      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ site: serializeSite(updated) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/facilities/sites/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update site.' }, { status: 500 });
    }
  });
}
