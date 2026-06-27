import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateMeetingCode } from '@/lib/governance/codes';
import { serializeMeeting } from '@/lib/governance/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const { meetings, openActions, adoptedResolutions } = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

        const [meetingRows, openActionCount, adoptedResolutionCount] = await Promise.all([
          tx.governanceMeeting.findMany({
            where: {
              ...ctx.where(),
              outsourcingClientId: clientId,
              ...(status ? { status: status as never } : {}),
            },
            include: {
              createdBy: { select: { id: true, name: true, email: true } },
              _count: { select: { resolutions: true, actions: true } },
            },
            orderBy: { meetingDate: 'desc' },
            take: 100,
          }),
          tx.governanceActionItem.count({
            where: {
              ...ctx.where(),
              outsourcingClientId: clientId,
              status: { in: ['open', 'in_progress'] as never },
            },
          }),
          tx.governanceResolution.count({
            where: ctx.where({ outsourcingClientId: clientId, status: 'adopted' as never }),
          }),
        ]);

        return {
          meetings: meetingRows,
          openActions: openActionCount,
          adoptedResolutions: adoptedResolutionCount,
        };
      });

      return NextResponse.json({
        meetings: meetings.map(serializeMeeting),
        summary: {
          totalMeetings: meetings.length,
          openActions,
          adoptedResolutions,
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/governance/meetings',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load meetings.' }, { status: 500 });
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
    const meetingDate = typeof body.meetingDate === 'string' ? body.meetingDate.trim() : '';
    if (!title || !meetingDate) {
      return NextResponse.json({ error: 'Title and meeting date are required.' }, { status: 400 });
    }

    const location = typeof body.location === 'string' ? body.location.trim() : null;
    const minutesSummary = typeof body.minutesSummary === 'string' ? body.minutesSummary.trim() : null;
    const status =
      typeof body.status === 'string' && ['scheduled', 'completed', 'cancelled'].includes(body.status)
        ? body.status
        : 'scheduled';

    try {
      const created = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const meetingCode = await allocateMeetingCode(tx as never, clientId);

        return tx.governanceMeeting.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            meetingCode,
            title,
            meetingDate: new Date(meetingDate),
            location,
            minutesSummary,
            status: status as never,
            createdByUserId: ctx.staff.id,
          },
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            _count: { select: { resolutions: true, actions: true } },
          },
        });
      });

      return NextResponse.json({ meeting: serializeMeeting(created) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/governance/meetings',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create meeting.' }, { status: 500 });
    }
  });
}
