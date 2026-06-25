import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeMeeting } from '@/lib/governance/serialize';

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
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const existing = await prisma.governanceMeeting.findFirst({
      where: { id, outsourcingClientId: clientId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.governanceMeeting.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { resolutions: true, actions: true } },
      },
    });

    return NextResponse.json({ meeting: serializeMeeting(updated) });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/governance/meetings/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update meeting.' }, { status: 500 });
  }
}
