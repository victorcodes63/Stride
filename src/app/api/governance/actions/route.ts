import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeAction } from '@/lib/governance/serialize';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const resolutionId = request.nextUrl.searchParams.get('resolutionId')?.trim() || undefined;
    const meetingId = request.nextUrl.searchParams.get('meetingId')?.trim() || undefined;
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

    const actions = await prisma.governanceActionItem.findMany({
      where: {
        outsourcingClientId: clientId,
        ...(resolutionId ? { resolutionId } : {}),
        ...(meetingId ? { meetingId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        meeting: { select: { id: true, meetingCode: true, title: true } },
        resolution: { select: { id: true, resolutionCode: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return NextResponse.json({ actions: actions.map(serializeAction) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/governance/actions',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load actions.' }, { status: 500 });
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
  if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });

  const meetingId = typeof body.meetingId === 'string' ? body.meetingId.trim() : null;
  const resolutionId = typeof body.resolutionId === 'string' ? body.resolutionId.trim() : null;
  const description = typeof body.description === 'string' ? body.description.trim() : null;
  const dueDate =
    typeof body.dueDate === 'string' && body.dueDate.trim() ? new Date(body.dueDate) : null;
  const assigneeUserId = typeof body.assigneeUserId === 'string' ? body.assigneeUserId.trim() : null;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);

    if (meetingId) {
      const meeting = await prisma.governanceMeeting.findFirst({
        where: { id: meetingId, outsourcingClientId: clientId },
        select: { id: true },
      });
      if (!meeting) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }
    if (resolutionId) {
      const resolution = await prisma.governanceResolution.findFirst({
        where: { id: resolutionId, outsourcingClientId: clientId },
        select: { id: true },
      });
      if (!resolution) return NextResponse.json({ error: 'Resolution not found.' }, { status: 404 });
    }

    const created = await prisma.governanceActionItem.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        meetingId,
        resolutionId,
        title,
        description,
        dueDate,
        assigneeUserId: assigneeUserId || null,
        createdByUserId: user.id,
      },
      include: {
        meeting: { select: { id: true, meetingCode: true, title: true } },
        resolution: { select: { id: true, resolutionCode: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ action: serializeAction(created) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/governance/actions',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create action.' }, { status: 500 });
  }
}
