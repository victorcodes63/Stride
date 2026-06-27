import { NextRequest, NextResponse } from 'next/server';
import type { SupportTicketStatus } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import {
  pullSupportTicketFromControlPlane,
  pushSupportMessageToControlPlane,
} from '@/lib/support/control-plane-sync';
import { serializeSupportTicket } from '@/lib/support/serialize';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  return withTenant(request, async (ctx) => {
    try {
      let ticket = await ctx.run((tx) =>
        tx.supportTicket.findFirst({
          where: ctx.where({ id }),
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            messages: {
              where: { isInternal: false },
              orderBy: { createdAt: 'asc' },
            },
          },
        }),
      );

      if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
      }

      if (ticket.controlPlaneTicketId) {
        const remote = await pullSupportTicketFromControlPlane({
          controlPlaneTicketId: ticket.controlPlaneTicketId,
          ticketNumber: ticket.ticketNumber,
        });

        if (remote) {
          const status = remote.status as SupportTicketStatus;
          if (status !== ticket.status) {
            ticket = await ctx.run((tx) =>
              tx.supportTicket.update({
                where: { id: ticket!.id },
                data: {
                  status,
                  ...(status === 'resolved' ? { resolvedAt: new Date() } : {}),
                  ...(status === 'closed' ? { closedAt: new Date() } : {}),
                },
                include: {
                  createdBy: { select: { id: true, name: true, email: true } },
                  messages: {
                    where: { isInternal: false },
                    orderBy: { createdAt: 'asc' },
                  },
                },
              }),
            );
          }

          const localIds = new Set(ticket.messages.map((m) => m.id));
          const newSupportMessages = remote.messages.filter(
            (m) => m.authorType === 'raven_staff' && !localIds.has(m.id),
          );

          for (const msg of newSupportMessages) {
            await ctx.run((tx) =>
              tx.supportTicketMessage.create({
                data: {
                  id: msg.id,
                  organizationId: ctx.organizationId,
                  ticketId: ticket!.id,
                  authorType: 'support',
                  authorName: msg.authorName,
                  body: msg.body,
                },
              }),
            );
          }

          if (newSupportMessages.length > 0) {
            ticket = await ctx.run((tx) =>
              tx.supportTicket.findFirst({
                where: ctx.where({ id }),
                include: {
                  createdBy: { select: { id: true, name: true, email: true } },
                  messages: {
                    where: { isInternal: false },
                    orderBy: { createdAt: 'asc' },
                  },
                },
              }),
            );
          }
        }
      }

      return NextResponse.json({ ticket: ticket ? serializeSupportTicket(ticket) : null });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/support/tickets/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load ticket.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  return withTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const messageBody = typeof body.body === 'string' ? body.body.trim() : '';
    if (!messageBody) {
      return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
    }

    try {
      const ticket = await ctx.run((tx) =>
        tx.supportTicket.findFirst({
          where: ctx.where({ id }),
          select: {
            id: true,
            status: true,
            controlPlaneTicketId: true,
          },
        }),
      );

      if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
      }

      if (ticket.status === 'closed') {
        return NextResponse.json({ error: 'This ticket is closed.' }, { status: 400 });
      }

      const message = await ctx.run((tx) =>
        tx.supportTicketMessage.create({
          data: {
            organizationId: ctx.organizationId,
            ticketId: ticket.id,
            authorType: 'customer',
            authorUserId: ctx.staff.id,
            authorName: ctx.staff.name,
            body: messageBody,
          },
        }),
      );

      if (ticket.controlPlaneTicketId) {
        await pushSupportMessageToControlPlane({
          controlPlaneTicketId: ticket.controlPlaneTicketId,
          externalId: message.id,
          authorName: ctx.staff.name,
          body: messageBody,
        });
      }

      if (ticket.status === 'waiting_on_customer') {
        await ctx.run((tx) =>
          tx.supportTicket.update({
            where: { id: ticket.id },
            data: { status: 'in_progress' },
          }),
        );
      }

      return NextResponse.json(
        {
          message: {
            id: message.id,
            authorType: message.authorType,
            authorName: message.authorName,
            body: message.body,
            createdAt: message.createdAt.toISOString(),
          },
        },
        { status: 201 },
      );
    } catch (error) {
      await reportApiError({
        route: 'POST /api/support/tickets/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to add message.' }, { status: 500 });
    }
  });
}
