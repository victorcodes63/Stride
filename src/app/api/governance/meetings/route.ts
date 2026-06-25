import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateMeetingCode } from '@/lib/governance/codes';
import { serializeMeeting } from '@/lib/governance/serialize';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

    const [meetings, openActions, adoptedResolutions] = await Promise.all([
      prisma.governanceMeeting.findMany({
        where: {
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
      prisma.governanceActionItem.count({
        where: {
          outsourcingClientId: clientId,
          status: { in: ['open', 'in_progress'] },
        },
      }),
      prisma.governanceResolution.count({
        where: { outsourcingClientId: clientId, status: 'adopted' },
      }),
    ]);

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
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const meetingCode = await allocateMeetingCode(prisma, clientId);

    const created = await prisma.governanceMeeting.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        meetingCode,
        title,
        meetingDate: new Date(meetingDate),
        location,
        minutesSummary,
        status: status as never,
        createdByUserId: user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { resolutions: true, actions: true } },
      },
    });

    return NextResponse.json({ meeting: serializeMeeting(created) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/governance/meetings',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create meeting.' }, { status: 500 });
  }
}
