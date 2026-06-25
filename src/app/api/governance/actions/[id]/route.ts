import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeAction } from '@/lib/governance/serialize';

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
  if (typeof body.description === 'string') data.description = body.description.trim() || null;
  if (
    typeof body.status === 'string' &&
    ['open', 'in_progress', 'done', 'cancelled'].includes(body.status)
  ) {
    data.status = body.status;
    if (body.status === 'done') data.completedAt = new Date();
    else if (body.status !== 'done') data.completedAt = null;
  }
  if (typeof body.dueDate === 'string') {
    data.dueDate = body.dueDate.trim() ? new Date(body.dueDate) : null;
  }
  if (typeof body.assigneeUserId === 'string') {
    data.assigneeUserId = body.assigneeUserId.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const existing = await prisma.governanceActionItem.findFirst({
      where: { id, outsourcingClientId: clientId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.governanceActionItem.update({
      where: { id },
      data,
      include: {
        meeting: { select: { id: true, meetingCode: true, title: true } },
        resolution: { select: { id: true, resolutionCode: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ action: serializeAction(updated) });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/governance/actions/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update action.' }, { status: 500 });
  }
}
