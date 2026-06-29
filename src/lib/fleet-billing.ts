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

export async function resolveFleetCustomerAccountsClient(
  prisma: PrismaClient,
  input: {
    customerId: string;
    organizationId: string;
    outsourcingClientId: string;
    customerName: string;
    contactEmail?: string | null;
  },
) {
  const customer = await prisma.fleetCustomer.findUnique({
    where: { id: input.customerId },
    select: { accountsClientId: true, name: true, contactEmail: true },
  });

  if (customer?.accountsClientId) {
    const linked = await prisma.accountsClient.findFirst({
      where: {
        id: customer.accountsClientId,
        organizationId: input.organizationId,
      },
    });
    if (linked) return linked;
  }

  const byName = await prisma.accountsClient.findFirst({
    where: {
      organizationId: input.organizationId,
      name: { equals: input.customerName, mode: 'insensitive' },
    },
  });
  if (byName) return byName;

  const email = input.contactEmail ?? customer?.contactEmail;
  if (email) {
    const byEmail = await prisma.accountsClient.findFirst({
      where: {
        organizationId: input.organizationId,
        contactEmail: { equals: email, mode: 'insensitive' },
      },
    });
    if (byEmail) return byEmail;
  }

  return prisma.accountsClient.findUnique({
    where: { outsourcingClientId: input.outsourcingClientId },
  });
}

export async function createFleetClientInvoice(
  prisma: PrismaClient,
  input: {
    tripId: string;
    customerId: string;
    organizationId: string;
    outsourcingClientId: string;
    tripNumber: string;
    customerName: string;
    customerContactEmail?: string | null;
    origin: string;
    destination: string;
    plannedDistanceKm: number | null;
    cargoWeightKg: number | null;
    cargoType: string | null;
  },
): Promise<{ invoiceId: string; invoiceNumber: number }> {
  const accountsClient = await resolveFleetCustomerAccountsClient(prisma, {
    customerId: input.customerId,
    organizationId: input.organizationId,
    outsourcingClientId: input.outsourcingClientId,
    customerName: input.customerName,
    contactEmail: input.customerContactEmail,
  });

  if (!accountsClient) {
    throw new Error(
      'No billing profile for this fleet customer. Link an accounts client on the customer record.',
    );
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
        organizationId: input.organizationId,
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
              organizationId: input.organizationId,
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
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          accountsClientId: accountsClient.id,
        },
      },
    });

    return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
  });
}

export type FleetArAgeingRow = {
  invoiceId: string;
  invoiceNumber: number;
  clientName: string;
  tripNumber: string | null;
  issueDate: string;
  dueDate: string | null;
  amountIncVat: number;
  daysOutstanding: number;
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
};

export function ageingBucket(daysOutstanding: number): FleetArAgeingRow['bucket'] {
  if (daysOutstanding <= 0) return 'current';
  if (daysOutstanding <= 30) return '1-30';
  if (daysOutstanding <= 60) return '31-60';
  if (daysOutstanding <= 90) return '61-90';
  return '90+';
}

export async function listFleetArAgeing(
  prisma: PrismaClient,
  organizationId: string,
  outsourcingClientId: string,
): Promise<FleetArAgeingRow[]> {
  const invoices = await prisma.accountsInvoice.findMany({
    where: {
      organizationId,
      status: { in: ['unpaid', 'partial'] },
      fleetTripBill: {
        outsourcingClientId,
      },
    },
    include: {
      accountsClient: { select: { name: true } },
      fleetTripBill: { select: { tripNumber: true } },
      lines: { select: { amountExVat: true } },
    },
    orderBy: { dueDate: 'asc' },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return invoices.map((inv) => {
    const exVat = inv.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
    const amountIncVat = Math.round(exVat * (1 + inv.vatRateBps / 10000));
    const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.issueDate);
    due.setHours(0, 0, 0, 0);
    const daysOutstanding = Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));

    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.accountsClient.name,
      tripNumber: inv.fleetTripBill?.tripNumber ?? null,
      issueDate: inv.issueDate.toISOString().slice(0, 10),
      dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? null,
      amountIncVat,
      daysOutstanding,
      bucket: ageingBucket(daysOutstanding),
    };
  });
}
