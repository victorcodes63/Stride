import { Prisma } from '@prisma/client';
import type { PrismaClient, FleetSettlement } from '@prisma/client';

async function findOrCreateFleetVendor(
  tx: Prisma.TransactionClient,
  payeeName: string,
): Promise<string> {
  const existing = await tx.accountsVendor.findFirst({
    where: { name: { equals: payeeName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.accountsVendor.create({
    data: {
      name: payeeName,
      notes: 'Auto-created from Fleet settlement posting',
    },
    select: { id: true },
  });
  return created.id;
}

/** Post AccountsVendorBill when a fleet settlement is marked paid (RAV-43). */
export async function postFleetSettlementVendorBill(
  tx: Prisma.TransactionClient,
  settlement: Pick<
    FleetSettlement,
    'id' | 'payeeName' | 'amountKes' | 'settlementType' | 'tripId'
  >,
  tripLabel: string,
): Promise<{ billId: string } | null> {
  const amount = Number(settlement.amountKes);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const vendorId = await findOrCreateFleetVendor(tx, settlement.payeeName);
  const today = new Date();
  const issueDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  const bill = await tx.accountsVendorBill.create({
    data: {
      vendorId,
      billRef: `FLEET-${settlement.id.slice(-8).toUpperCase()}`,
      issueDate,
      dueDate: issueDate,
      currency: 'KES',
      status: 'paid',
      notes: `Fleet ${settlement.settlementType} settlement · ${tripLabel}`,
      lines: {
        create: [
          {
            item: `Fleet settlement — ${settlement.payeeName}`,
            description: tripLabel,
            amountExVat: new Prisma.Decimal(amount),
            sortOrder: 0,
          },
        ],
      },
    },
    select: { id: true },
  });

  return { billId: bill.id };
}
