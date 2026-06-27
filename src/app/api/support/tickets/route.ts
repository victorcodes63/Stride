import { NextRequest, NextResponse } from 'next/server';
import type { SupportTicketCategory, SupportTicketPriority } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import { allocateSupportTicketNumber } from '@/lib/support/ticket-code';
import { pushSupportTicketToControlPlane } from '@/lib/support/control-plane-sync';
import { serializeSupportTicket } from '@/lib/support/serialize';

const CATEGORIES: SupportTicketCategory[] = [
  'incident',
  'service_request',
  'access_permissions',
  'payroll_statutory',
  'data_import',
  'billing_account',
  'feature_request',
  'other',
];

const PRIORITIES: SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

    const tickets = await ctx.run((tx) =>
      tx.supportTicket.findMany({
        where: ctx.where(status ? { status: status as never } : {}),
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { messages: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 100,
      }),
    );

    return NextResponse.json({ tickets: tickets.map(serializeSupportTicket) });
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

    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!subject || !description) {
      return NextResponse.json({ error: 'Subject and description are required.' }, { status: 400 });
    }

    const category =
      typeof body.category === 'string' && CATEGORIES.includes(body.category as SupportTicketCategory)
        ? (body.category as SupportTicketCategory)
        : 'other';
    const priority =
      typeof body.priority === 'string' && PRIORITIES.includes(body.priority as SupportTicketPriority)
        ? (body.priority as SupportTicketPriority)
        : 'medium';

    try {
      const created = await ctx.run(async (tx) => {
        const ticketNumber = await allocateSupportTicketNumber(tx, ctx.organizationId);
        const ticket = await tx.supportTicket.create({
          data: {
            organizationId: ctx.organizationId,
            ticketNumber,
            subject,
            description,
            category,
            priority,
            createdByUserId: ctx.staff.id,
            reporterName: ctx.staff.name,
            reporterEmail: ctx.staff.email,
          },
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
          },
        });

        await tx.supportTicketMessage.create({
          data: {
            organizationId: ctx.organizationId,
            ticketId: ticket.id,
            authorType: 'customer',
            authorUserId: ctx.staff.id,
            authorName: ctx.staff.name,
            body: description,
          },
        });

        return ticket;
      });

      const controlPlaneTicketId = await pushSupportTicketToControlPlane({
        ticket: created,
        reporterUserId: ctx.staff.id,
      });

      if (controlPlaneTicketId) {
        await ctx.run((tx) =>
          tx.supportTicket.update({
            where: { id: created.id },
            data: { controlPlaneTicketId },
          }),
        );
        created.controlPlaneTicketId = controlPlaneTicketId;
      }

      await ctx.audit({
        action: 'support_ticket.created',
        entityType: 'SupportTicket',
        entityId: created.id,
        route: 'POST /api/support/tickets',
        metadata: { ticketNumber: created.ticketNumber, category, priority },
      });

      return NextResponse.json({ ticket: serializeSupportTicket(created) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/support/tickets',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create support ticket.' }, { status: 500 });
    }
  });
}
