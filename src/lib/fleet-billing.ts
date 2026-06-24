import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { estimateTripFreightExVatKes } from '@/lib/fleet-settlement';

async function nextInvoiceNumber(tx: Prisma.TransactionClient): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242);`;
  const maxInvoiceNumber = await tx.accountsInvoice.aggregate({
    _max: { invoiceNumber: true },
  });
  return (maxInvoiceNumber._max.invoiceNumber ?? 0) + 1;
}

async function resolveDefaultPaymentAccountId(tx: Prisma.TransactionClient): Promise<string | null> {
  const account = await tx.accountsPaymentAccount.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, legacyKind: true },
  });
  return account?.id ?? null;
}

export async function createFleetClientInvoice(
  prisma: PrismaClient,
  input: {
    tripId: string;
    outsourcingClientId: string;
    tripNumber: string;
    customerName: string;
    origin: string;
    destination: string;
    plannedDistanceKm: number | null;
    cargoWeightKg: number | null;
    cargoType: string | null;
  },
): Promise<{ invoiceId: string; invoiceNumber: number }> {
  const accountsClient = await prisma.accountsClient.findUnique({
    where: { outsourcingClientId: input.outsourcingClientId },
  });
  if (!accountsClient) {
    throw new Error('No billing profile linked to this workspace. Sync accounts clients first.');
  }

  const amountExVat = estimateTripFreightExVatKes({
    plannedDistanceKm: input.plannedDistanceKm,
    cargoWeightKg: input.cargoWeightKg,
  });

  const today = new Date();
  const issueDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dueDate = new Date(issueDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + 30);

  return prisma.$transaction(async (tx) => {
    const paymentAccountId = await resolveDefaultPaymentAccountId(tx);
    if (!paymentAccountId) {
      throw new Error('No active payment account configured for invoicing.');
    }

    const paymentAccount = await tx.accountsPaymentAccount.findUnique({
      where: { id: paymentAccountId },
      select: { legacyKind: true },
    });

    const invoiceNumber = await nextInvoiceNumber(tx);
    const invoice = await tx.accountsInvoice.create({
      data: {
        clientId: accountsClient.id,
        invoiceNumber,
        issueDate,
        dueDate,
        taxDate: issueDate,
        currency: accountsClient.currency || 'KES',
        status: 'unpaid',
        paymentAccountId,
        paymentBank: paymentAccount?.legacyKind ?? 'consultancy_fees',
        notes: `Fleet transport — ${input.tripNumber}`,
        lines: {
          create: [
            {
              item: `Transport: ${input.origin} → ${input.destination}`,
              description: `${input.customerName}${input.cargoType ? ` · ${input.cargoType}` : ''} (${input.tripNumber})`,
              amountExVat: new Prisma.Decimal(amountExVat),
              sortOrder: 0,
            },
          ],
        },
      },
      select: { id: true, invoiceNumber: true },
    });

    await tx.fleetTrip.update({
      where: { id: input.tripId },
      data: {
        clientInvoiceId: invoice.id,
        status: 'invoiced',
      },
    });

    await tx.fleetTripEvent.create({
      data: {
        tripId: input.tripId,
        eventType: 'invoiced',
        message: `Client invoice #${invoice.invoiceNumber} created for ${input.customerName}.`,
        metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
      },
    });

    return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
  });
}
