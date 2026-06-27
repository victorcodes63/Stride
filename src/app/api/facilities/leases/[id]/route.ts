import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeLease } from '@/lib/facilities/serialize';
import { withTenant } from '@/lib/tenant-api';

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
      const updated = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const existing = await tx.facilityLease.findFirst({
          where: { id, ...ctx.where(), site: { outsourcingClientId: clientId } },
          select: { id: true },
        });
        if (!existing) return null;

        return tx.facilityLease.update({
          where: { id },
          data,
          include: {
            site: { select: { id: true, siteCode: true, name: true } },
          },
        });
      });

      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ lease: serializeLease(updated) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/facilities/leases/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update lease.' }, { status: 500 });
    }
  });
}
