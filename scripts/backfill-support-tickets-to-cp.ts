/**
 * Push local SupportTicket rows that never synced to the control plane.
 * Usage: npx tsx scripts/backfill-support-tickets-to-cp.ts [--ticket SUP-0001]
 */
import { PrismaClient } from '@prisma/client';

import { pushSupportTicketToControlPlane } from '../src/lib/support/control-plane-sync';

const prisma = new PrismaClient();

async function main() {
  const ticketNumberArg = process.argv.find((arg) => arg.startsWith('--ticket='))?.split('=')[1]?.trim();

  const tickets = await prisma.supportTicket.findMany({
    where: {
      controlPlaneTicketId: null,
      ...(ticketNumberArg ? { ticketNumber: ticketNumberArg } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });

  if (tickets.length === 0) {
    console.log('No unsynced support tickets found.');
    return;
  }

  let synced = 0;
  for (const ticket of tickets) {
    const controlPlaneTicketId = await pushSupportTicketToControlPlane({
      ticket,
      reporterUserId: ticket.createdByUserId,
    });

    if (!controlPlaneTicketId) {
      console.warn(`✗ ${ticket.ticketNumber} — sync failed (check CONTROL_PLANE_* env and org entitlements slug)`);
      continue;
    }

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { controlPlaneTicketId },
    });
    console.log(`✓ ${ticket.ticketNumber} → control plane ${controlPlaneTicketId}`);
    synced += 1;
  }

  console.log(`\nSynced ${synced} of ${tickets.length} ticket(s).`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
