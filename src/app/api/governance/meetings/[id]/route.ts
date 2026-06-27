import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeMeeting } from '@/lib/governance/serialize';
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
    if (typeof body.location === 'string') data.location = body.location.trim() || null;
    if (typeof body.minutesSummary === 'string') data.minutesSummary = body.minutesSummary.trim() || null;
    if (typeof body.meetingDate === 'string' && body.meetingDate.trim()) {
      data.meetingDate = new Date(body.meetingDate);
    }
    if (
      typeof body.status === 'string' &&
      ['scheduled', 'completed', 'cancelled'].includes(body.status)
    ) {
      data.status = body.status;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    try {
      const updated = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const existing = await tx.governanceMeeting.findFirst({
          where: ctx.where({ id, outsourcingClientId: clientId }),
          select: { id: true },
        });
        if (!existing) return null;

        return tx.governanceMeeting.update({
          where: { id },
          data,
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            _count: { select: { resolutions: true, actions: true } },
          },
        });
      });

      if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ meeting: serializeMeeting(updated) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/governance/meetings/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update meeting.' }, { status: 500 });
    }
  });
}
