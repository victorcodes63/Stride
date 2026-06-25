import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateResolutionCode } from '@/lib/governance/codes';
import { serializeResolution } from '@/lib/governance/serialize';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const meetingId = request.nextUrl.searchParams.get('meetingId')?.trim() || undefined;
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

    const resolutions = await prisma.governanceResolution.findMany({
      where: {
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

    return NextResponse.json({ resolutions: resolutions.map(serializeResolution) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/governance/resolutions',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load resolutions.' }, { status: 500 });
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
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    if (meetingId) {
      const meeting = await prisma.governanceMeeting.findFirst({
        where: { id: meetingId, outsourcingClientId: clientId },
        select: { id: true },
      });
      if (!meeting) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    }

    const resolutionCode = await allocateResolutionCode(prisma, clientId);
    const adoptedAt = status === 'adopted' ? new Date() : null;

    const created = await prisma.governanceResolution.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        meetingId,
        resolutionCode,
        title,
        description,
        status: status as never,
        adoptedAt,
        effectiveDate,
        createdByUserId: user.id,
      },
      include: {
        meeting: { select: { id: true, meetingCode: true, title: true } },
        _count: { select: { actions: true } },
      },
    });

    return NextResponse.json({ resolution: serializeResolution(created) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/governance/resolutions',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create resolution.' }, { status: 500 });
  }
}
