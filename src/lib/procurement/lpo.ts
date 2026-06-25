import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export function lineTotal(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export async function nextLpoNumber(db: Db, outsourcingClientId: string) {
  const count = await db.purchaseOrder.count({ where: { outsourcingClientId } });
  return `LPO-${String(count + 1).padStart(4, '0')}`;
}

export async function createLpoFromPurchaseRequest(
  db: Db,
  params: {
    organizationId: string;
    purchaseRequestId: string;
    outsourcingClientId: string;
  },
) {
  const request = await db.purchaseRequest.findFirst({
    where: { id: params.purchaseRequestId, outsourcingClientId: params.outsourcingClientId },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!request) {
    throw new Error('Purchase request not found.');
  }
  if (request.status !== 'approved') {
    throw new Error('Purchase request must be approved before creating an LPO.');
  }
  if (!request.vendorId) {
    throw new Error('Purchase request must have a vendor before creating an LPO.');
  }

  const existing = await db.purchaseOrder.findUnique({
    where: { purchaseRequestId: request.id },
    select: { id: true, lpoNumber: true },
  });
  if (existing) return existing;

  const lpoNumber = await nextLpoNumber(db, params.outsourcingClientId);
  const totalAmount = request.lines.reduce(
    (sum, line) => sum + lineTotal(Number(line.quantity), Number(line.unitPrice)),
    0,
  );

  return db.purchaseOrder.create({
    data: {
      organizationId: params.organizationId,
      outsourcingClientId: params.outsourcingClientId,
      purchaseRequestId: request.id,
      lpoNumber,
      title: request.title,
      currency: request.currency,
      totalAmount,
      status: 'draft',
      vendorId: request.vendorId,
      lines: {
        create: request.lines.map((line) => ({
          organizationId: params.organizationId,
          item: line.item,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          sortOrder: line.sortOrder,
        })),
      },
    },
    select: { id: true, lpoNumber: true },
  });
}
