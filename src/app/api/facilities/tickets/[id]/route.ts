import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeTicket } from '@/lib/facilities/serialize';

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
    typeof body.category === 'string' &&
    ['plumbing', 'electrical', 'hvac', 'structural', 'cleaning', 'other'].includes(body.category)
  ) {
    data.category = body.category;
  }
  if (
    typeof body.priority === 'string' &&
    ['low', 'medium', 'high', 'urgent'].includes(body.priority)
  ) {
    data.priority = body.priority;
  }
  if (
    typeof body.status === 'string' &&
    ['open', 'in_progress', 'on_hold', 'resolved', 'closed'].includes(body.status)
  ) {
    data.status = body.status;
    if (body.status === 'resolved' || body.status === 'closed') {
      data.resolvedAt = new Date();
    } else {
      data.resolvedAt = null;
    }
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
    const existing = await prisma.facilityMaintenanceTicket.findFirst({
      where: { id, outsourcingClientId: clientId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = await prisma.facilityMaintenanceTicket.update({
      where: { id },
      data,
      include: {
        site: { select: { id: true, siteCode: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        reportedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ ticket: serializeTicket(updated) });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/facilities/tickets/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update ticket.' }, { status: 500 });
  }
}
