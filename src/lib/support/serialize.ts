import type { SupportTicket, SupportTicketMessage, User } from '@prisma/client';

export type SupportTicketRow = SupportTicket & {
  createdBy?: Pick<User, 'id' | 'name' | 'email'> | null;
  messages?: SupportTicketMessage[];
  _count?: { messages: number };
};

export function serializeSupportTicket(ticket: SupportTicketRow) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    reporterName: ticket.reporterName,
    reporterEmail: ticket.reporterEmail,
    controlPlaneTicketId: ticket.controlPlaneTicketId,
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    createdBy: ticket.createdBy
      ? { id: ticket.createdBy.id, name: ticket.createdBy.name, email: ticket.createdBy.email }
      : null,
    messageCount: ticket._count?.messages ?? ticket.messages?.length ?? 0,
    messages: ticket.messages
      ?.filter((m) => !m.isInternal)
      .map(serializeSupportTicketMessage),
  };
}

export function serializeSupportTicketMessage(message: SupportTicketMessage) {
  return {
    id: message.id,
    authorType: message.authorType,
    authorName: message.authorName,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}
