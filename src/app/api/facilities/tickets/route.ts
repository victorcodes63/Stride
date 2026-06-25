import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateTicketNumber } from '@/lib/facilities/ticket-code';
import { serializeTicket } from '@/lib/facilities/serialize';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const siteId = request.nextUrl.searchParams.get('siteId')?.trim() || undefined;
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

    const tickets = await prisma.facilityMaintenanceTicket.findMany({
      where: {
        outsourcingClientId: clientId,
        ...(siteId ? { siteId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        site: { select: { id: true, siteCode: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        reportedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return NextResponse.json({ tickets: tickets.map(serializeTicket) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/facilities/tickets',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load tickets.' }, { status: 500 });
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

  const siteId = typeof body.siteId === 'string' ? body.siteId.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!siteId || !title) {
    return NextResponse.json({ error: 'Site and title are required.' }, { status: 400 });
  }

  const description = typeof body.description === 'string' ? body.description.trim() : null;
  const category =
    typeof body.category === 'string' &&
    ['plumbing', 'electrical', 'hvac', 'structural', 'cleaning', 'other'].includes(body.category)
      ? body.category
      : 'other';
  const priority =
    typeof body.priority === 'string' && ['low', 'medium', 'high', 'urgent'].includes(body.priority)
      ? body.priority
      : 'medium';
  const dueDate = typeof body.dueDate === 'string' && body.dueDate.trim() ? new Date(body.dueDate) : null;
  const assigneeUserId = typeof body.assigneeUserId === 'string' ? body.assigneeUserId.trim() : null;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const site = await prisma.facilitySite.findFirst({
      where: { id: siteId, outsourcingClientId: clientId },
      select: { id: true },
    });
    if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });

    const ticketNumber = await allocateTicketNumber(prisma, clientId);

    const created = await prisma.facilityMaintenanceTicket.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        siteId,
        ticketNumber,
        title,
        description,
        category: category as never,
        priority: priority as never,
        dueDate,
        reportedByUserId: user.id,
        assigneeUserId: assigneeUserId || null,
        createdByUserId: user.id,
      },
      include: {
        site: { select: { id: true, siteCode: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        reportedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ ticket: serializeTicket(created) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/facilities/tickets',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create ticket.' }, { status: 500 });
  }
}
