/**
 * Inventory ATP + reservation helpers for SalesOrder confirm/ship.
 */

import { Prisma } from '@prisma/client';
import { qtyToBase } from '@/lib/sales/uom';

export function availableToPromise(stock: { qtyOnHand: Prisma.Decimal | number; qtyReserved: Prisma.Decimal | number }) {
  return Math.max(0, Number(stock.qtyOnHand) - Number(stock.qtyReserved));
}

export async function getOrCreateStock(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; facilitySiteId: string; productId: string },
) {
  const existing = await tx.inventoryStock.findUnique({
    where: {
      facilitySiteId_productId: {
        facilitySiteId: params.facilitySiteId,
        productId: params.productId,
      },
    },
  });
  if (existing) return existing;
  return tx.inventoryStock.create({
    data: {
      organizationId: params.organizationId,
      facilitySiteId: params.facilitySiteId,
      productId: params.productId,
      qtyOnHand: 0,
      qtyReserved: 0,
    },
  });
}

export async function receiveStock(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    facilitySiteId: string;
    productId: string;
    qtyBase: number;
    userId?: string | null;
    notes?: string | null;
  },
) {
  const stock = await getOrCreateStock(tx, params);
  const next = Number(stock.qtyOnHand) + params.qtyBase;
  await tx.inventoryStock.update({
    where: { id: stock.id },
    data: { qtyOnHand: new Prisma.Decimal(next) },
  });
  await tx.inventoryMovement.create({
    data: {
      organizationId: params.organizationId,
      facilitySiteId: params.facilitySiteId,
      productId: params.productId,
      type: 'receipt',
      qtyBase: new Prisma.Decimal(params.qtyBase),
      notes: params.notes ?? null,
      createdByUserId: params.userId ?? null,
    },
  });
}

export type AtpLineNeed = {
  orderLineId: string;
  productId: string;
  description: string;
  uom: string;
  qtyOrdered: number;
};

export async function assertAtpForOrderLines(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    facilitySiteId: string;
    lines: AtpLineNeed[];
  },
): Promise<{ ok: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  for (const line of params.lines) {
    if (!line.productId) continue;
    const needBase = await qtyToBase(tx, line.productId, line.uom, line.qtyOrdered);
    const stock = await getOrCreateStock(tx, {
      organizationId: params.organizationId,
      facilitySiteId: params.facilitySiteId,
      productId: line.productId,
    });
    const atp = availableToPromise(stock);
    if (needBase > atp + 1e-9) {
      warnings.push(
        `Insufficient ATP for ${line.description}: need ${needBase} base, available ${atp}.`,
      );
    }
  }
  return { ok: warnings.length === 0, warnings };
}

export async function reserveOrderLines(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    facilitySiteId: string;
    lines: AtpLineNeed[];
  },
) {
  for (const line of params.lines) {
    if (!line.productId) continue;
    const needBase = await qtyToBase(tx, line.productId, line.uom, line.qtyOrdered);
    const stock = await getOrCreateStock(tx, {
      organizationId: params.organizationId,
      facilitySiteId: params.facilitySiteId,
      productId: line.productId,
    });
    await tx.inventoryStock.update({
      where: { id: stock.id },
      data: { qtyReserved: new Prisma.Decimal(Number(stock.qtyReserved) + needBase) },
    });
    await tx.inventoryReservation.create({
      data: {
        organizationId: params.organizationId,
        facilitySiteId: params.facilitySiteId,
        productId: line.productId,
        salesOrderLineId: line.orderLineId,
        qtyBase: new Prisma.Decimal(needBase),
        status: 'open',
      },
    });
    await tx.inventoryMovement.create({
      data: {
        organizationId: params.organizationId,
        facilitySiteId: params.facilitySiteId,
        productId: line.productId,
        type: 'reserve',
        qtyBase: new Prisma.Decimal(needBase),
        referenceType: 'sales_order_line',
        referenceId: line.orderLineId,
      },
    });
    await tx.salesOrderLine.update({
      where: { id: line.orderLineId },
      data: { qtyReserved: new Prisma.Decimal(line.qtyOrdered) },
    });
  }
}

/** On POD / ship: consume reservation (reduce on-hand + reserved). */
export async function consumeReservationsForOrder(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; orderId: string },
) {
  const lines = await tx.salesOrderLine.findMany({
    where: { orderId: params.orderId, organizationId: params.organizationId },
  });
  for (const line of lines) {
    const reservations = await tx.inventoryReservation.findMany({
      where: { salesOrderLineId: line.id, status: 'open' },
    });
    for (const res of reservations) {
      const stock = await getOrCreateStock(tx, {
        organizationId: params.organizationId,
        facilitySiteId: res.facilitySiteId,
        productId: res.productId,
      });
      const qty = Number(res.qtyBase);
      await tx.inventoryStock.update({
        where: { id: stock.id },
        data: {
          qtyOnHand: new Prisma.Decimal(Math.max(0, Number(stock.qtyOnHand) - qty)),
          qtyReserved: new Prisma.Decimal(Math.max(0, Number(stock.qtyReserved) - qty)),
        },
      });
      await tx.inventoryReservation.update({
        where: { id: res.id },
        data: { status: 'consumed' },
      });
      await tx.inventoryMovement.create({
        data: {
          organizationId: params.organizationId,
          facilitySiteId: res.facilitySiteId,
          productId: res.productId,
          type: 'issue',
          qtyBase: new Prisma.Decimal(qty),
          referenceType: 'sales_order',
          referenceId: params.orderId,
        },
      });
    }
    await tx.salesOrderLine.update({
      where: { id: line.id },
      data: {
        qtyShipped: line.qtyOrdered,
        qtyReserved: 0,
      },
    });
  }
}
