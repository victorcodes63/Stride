import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateTicketNumber } from '@/lib/facilities/ticket-code';
import { serializeTicket } from '@/lib/facilities/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const tickets = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const siteId = request.nextUrl.searchParams.get('siteId')?.trim() || undefined;
        const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

        return tx.facilityMaintenanceTicket.findMany({
          where: {
            ...ctx.where(),
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
      });

      return NextResponse.json({ tickets: tickets.map(serializeTicket) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/facilities/tickets',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load tickets.' }, { status: 500 });
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
      const created = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const site = await tx.facilitySite.findFirst({
          where: ctx.where({ id: siteId, outsourcingClientId: clientId }),
          select: { id: true },
        });
        if (!site) return null;

        const ticketNumber = await allocateTicketNumber(tx as never, clientId);

        return tx.facilityMaintenanceTicket.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            siteId,
            ticketNumber,
            title,
            description,
            category: category as never,
            priority: priority as never,
            dueDate,
            reportedByUserId: ctx.staff.id,
            assigneeUserId: assigneeUserId || null,
            createdByUserId: ctx.staff.id,
          },
          include: {
            site: { select: { id: true, siteCode: true, name: true } },
            assignee: { select: { id: true, name: true, email: true } },
            reportedBy: { select: { id: true, name: true, email: true } },
          },
        });
      });

      if (!created) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });
      return NextResponse.json({ ticket: serializeTicket(created) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/facilities/tickets',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create ticket.' }, { status: 500 });
    }
  });
}
