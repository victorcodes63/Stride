import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeResolution } from '@/lib/governance/serialize';
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
    if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
    if (typeof body.description === 'string') data.description = body.description.trim() || null;
    if (
      typeof body.status === 'string' &&
      ['draft', 'adopted', 'rejected', 'withdrawn'].includes(body.status)
    ) {
      data.status = body.status;
      if (body.status === 'adopted') data.adoptedAt = new Date();
    }
    if (typeof body.effectiveDate === 'string') {
      data.effectiveDate = body.effectiveDate.trim() ? new Date(body.effectiveDate) : null;
    }
    if (typeof body.meetingId === 'string') {
      data.meetingId = body.meetingId.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    try {
      const updated = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const existing = await tx.governanceResolution.findFirst({
          where: ctx.where({ id, outsourcingClientId: clientId }),
          select: { id: true },
        });
        if (!existing) return null;

        return tx.governanceResolution.update({
          where: { id },
          data,
          include: {
            meeting: { select: { id: true, meetingCode: true, title: true } },
            _count: { select: { actions: true } },
          },
        });
      });

      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ resolution: serializeResolution(updated) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/governance/resolutions/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update resolution.' }, { status: 500 });
    }
  });
}
