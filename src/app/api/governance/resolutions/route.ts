import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateResolutionCode } from '@/lib/governance/codes';
import { serializeResolution } from '@/lib/governance/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const resolutions = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const meetingId = request.nextUrl.searchParams.get('meetingId')?.trim() || undefined;
        const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

        return tx.governanceResolution.findMany({
          where: {
            ...ctx.where(),
            outsourcingClientId: clientId,
            ...(meetingId ? { meetingId } : {}),
            ...(status ? { status: status as never } : {}),
          },
          include: {
            meeting: { select: { id: true, meetingCode: true, title: true } },
            _count: { select: { actions: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        });
      });

      return NextResponse.json({ resolutions: resolutions.map(serializeResolution) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/governance/resolutions',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load resolutions.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });

    const meetingId = typeof body.meetingId === 'string' ? body.meetingId.trim() : null;
    const description = typeof body.description === 'string' ? body.description.trim() : null;
    const status =
      typeof body.status === 'string' &&
      ['draft', 'adopted', 'rejected', 'withdrawn'].includes(body.status)
        ? body.status
        : 'draft';
    const effectiveDate =
      typeof body.effectiveDate === 'string' && body.effectiveDate.trim()
        ? new Date(body.effectiveDate)
        : null;

    try {
      const created = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);

        if (meetingId) {
          const meeting = await tx.governanceMeeting.findFirst({
            where: ctx.where({ id: meetingId, outsourcingClientId: clientId }),
            select: { id: true },
          });
          if (!meeting) return null;
        }

        const resolutionCode = await allocateResolutionCode(tx as never, clientId);
        const adoptedAt = status === 'adopted' ? new Date() : null;

        return tx.governanceResolution.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            meetingId,
            resolutionCode,
            title,
            description,
            status: status as never,
            adoptedAt,
            effectiveDate,
            createdByUserId: ctx.staff.id,
          },
          include: {
            meeting: { select: { id: true, meetingCode: true, title: true } },
            _count: { select: { actions: true } },
          },
        });
      });

      if (!created) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
      return NextResponse.json({ resolution: serializeResolution(created) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/governance/resolutions',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create resolution.' }, { status: 500 });
    }
  });
}
