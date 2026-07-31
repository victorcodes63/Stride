/**
 * SalesOrder lifecycle — create, confirm (credit+ATP+reserve), ship, invoice, return.
 */

import { Prisma } from '@prisma/client';
import {
  createDraftAccountsInvoice,
  dueDateFromIssue,
} from '@/lib/accounts/billing-automation';
import {
  assertAtpForOrderLines,
  consumeReservationsForOrder,
  receiveStock,
  reserveOrderLines,
} from '@/lib/inventory/atp';
import { evaluateSalesCreditGate } from '@/lib/sales/cross-module-gates';
import { qtyToBase } from '@/lib/sales/uom';
import { randomBytes } from 'crypto';

export const SALES_ORDER_STATUSES = [
  'draft',
  'credit_hold',
  'confirmed',
  'partially_shipped',
  'shipped',
  'invoiced',
  'cancelled',
] as const;

export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];

function lineExt(qty: number, unitPrice: number, discountPct: number) {
  return Math.round(qty * unitPrice * (1 - Math.min(100, Math.max(0, discountPct)) / 100) * 100) / 100;
}

export function orderProposedAmount(
  lines: Array<{ qtyOrdered: Prisma.Decimal | number; unitPrice: Prisma.Decimal | number; discountPct: Prisma.Decimal | number }>,
) {
  return lines.reduce(
    (s, l) => s + lineExt(Number(l.qtyOrdered), Number(l.unitPrice), Number(l.discountPct)),
    0,
  );
}

export async function nextSalesOrderNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<number> {
  const latest = await tx.salesOrder.findFirst({
    where: { organizationId },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });
  return (latest?.orderNumber ?? 0) + 1;
}

export async function confirmSalesOrder(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    orderId: string;
    acknowledgeWarnings?: boolean;
  },
) {
  const order = await tx.salesOrder.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!order) throw Object.assign(new Error('ORDER_NOT_FOUND'), { code: 'ORDER_NOT_FOUND' });
  if (order.status !== 'draft' && order.status !== 'credit_hold') {
    throw Object.assign(new Error('ORDER_NOT_DRAFT'), { code: 'ORDER_NOT_DRAFT' });
  }
  if (!order.facilitySiteId) {
    throw Object.assign(new Error('WAREHOUSE_REQUIRED'), { code: 'WAREHOUSE_REQUIRED' });
  }
  if (order.lineItems.length === 0) {
    throw Object.assign(new Error('NO_LINES'), { code: 'NO_LINES' });
  }

  const proposed = orderProposedAmount(order.lineItems);
  const credit = await evaluateSalesCreditGate(tx, {
    organizationId: params.organizationId,
    accountsClientId: order.accountsClientId,
    proposedAmount: proposed,
  });
  const atp = await assertAtpForOrderLines(tx, {
    organizationId: params.organizationId,
    facilitySiteId: order.facilitySiteId,
    lines: order.lineItems.map((l) => ({
      orderLineId: l.id,
      productId: l.productId ?? '',
      description: l.description,
      uom: l.uom,
      qtyOrdered: Number(l.qtyOrdered),
    })),
  });

  const warnings = [...credit.warnings, ...atp.warnings];
  if (warnings.length > 0 && !params.acknowledgeWarnings) {
    if (credit.warnings.length > 0) {
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: 'credit_hold' },
      });
    }
    throw Object.assign(new Error('WARNINGS'), { code: 'WARNINGS', warnings });
  }

  await reserveOrderLines(tx, {
    organizationId: params.organizationId,
    facilitySiteId: order.facilitySiteId,
    lines: order.lineItems
      .filter((l) => l.productId)
      .map((l) => ({
        orderLineId: l.id,
        productId: l.productId!,
        description: l.description,
        uom: l.uom,
        qtyOrdered: Number(l.qtyOrdered),
      })),
  });

  return tx.salesOrder.update({
    where: { id: order.id },
    data: {
      status: 'confirmed',
      confirmedAt: new Date(),
      publicStatusToken: order.publicStatusToken ?? randomBytes(24).toString('hex'),
    },
    include: { lineItems: true, accountsClient: { select: { id: true, name: true } } },
  });
}

export async function shipSalesOrder(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    orderId: string;
    fleetOrderId?: string | null;
    pickupLocation?: string;
    deliveryLocation?: string;
    outsourcingClientId?: string;
    fleetCustomerId?: string;
  },
) {
  const order = await tx.salesOrder.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    include: { accountsClient: true, lineItems: true },
  });
  if (!order) throw Object.assign(new Error('ORDER_NOT_FOUND'), { code: 'ORDER_NOT_FOUND' });
  if (order.status !== 'confirmed' && order.status !== 'partially_shipped') {
    throw Object.assign(new Error('ORDER_NOT_CONFIRMED'), { code: 'ORDER_NOT_CONFIRMED' });
  }

  let fleetOrderId = params.fleetOrderId ?? order.fleetOrderId;
  if (!fleetOrderId && params.outsourcingClientId && params.fleetCustomerId) {
    const count = await tx.fleetOrder.count({
      where: { outsourcingClientId: params.outsourcingClientId },
    });
    const fo = await tx.fleetOrder.create({
      data: {
        organizationId: params.organizationId,
        outsourcingClientId: params.outsourcingClientId,
        customerId: params.fleetCustomerId,
        orderNumber: `SO-${order.orderNumber}-${count + 1}`,
        pickupLocation: params.pickupLocation || 'Warehouse',
        deliveryLocation: params.deliveryLocation || order.accountsClient.name,
        status: 'completed',
        notes: `Sales order SO-${order.orderNumber} POD`,
        salesOrderId: order.id,
      },
    });
    fleetOrderId = fo.id;
  }

  await consumeReservationsForOrder(tx, {
    organizationId: params.organizationId,
    orderId: order.id,
  });

  return tx.salesOrder.update({
    where: { id: order.id },
    data: {
      status: 'shipped',
      shippedAt: new Date(),
      fleetOrderId: fleetOrderId ?? undefined,
    },
    include: { lineItems: true },
  });
}

export async function invoiceSalesOrder(
  tx: Prisma.TransactionClient,
  params: { organizationId: string; orderId: string },
) {
  const order = await tx.salesOrder.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    include: {
      lineItems: true,
      accountsClient: {
        include: { outsourcingClient: { select: { paymentTerms: true } } },
      },
    },
  });
  if (!order) throw Object.assign(new Error('ORDER_NOT_FOUND'), { code: 'ORDER_NOT_FOUND' });
  if (order.status !== 'shipped' && order.status !== 'partially_shipped') {
    throw Object.assign(new Error('ORDER_NOT_SHIPPED'), { code: 'ORDER_NOT_SHIPPED' });
  }
  if (order.accountsInvoiceId) {
    throw Object.assign(new Error('INVOICE_EXISTS'), { code: 'INVOICE_EXISTS' });
  }

  const issueDate = new Date();
  const dueDate = dueDateFromIssue(
    issueDate,
    order.accountsClient.outsourcingClient?.paymentTerms ?? null,
  );

  const lines = order.lineItems
    .filter((l) => Number(l.qtyShipped) > 0)
    .map((l) => ({
      item: l.description,
      description: `SO-${order.orderNumber} · ${l.uom} × ${Number(l.qtyShipped)}`,
      amountExVat: lineExt(Number(l.qtyShipped), Number(l.unitPrice), Number(l.discountPct)),
    }));

  if (lines.length === 0) {
    throw Object.assign(new Error('NO_BILLABLE_LINES'), { code: 'NO_BILLABLE_LINES' });
  }

  const invoice = await createDraftAccountsInvoice(tx, {
    organizationId: params.organizationId,
    clientId: order.accountsClientId,
    issueDate,
    dueDate,
    currency: order.currency,
    notes: `Sales order SO-${order.orderNumber}`,
    lines,
  });

  for (const line of order.lineItems) {
    await tx.salesOrderLine.update({
      where: { id: line.id },
      data: { qtyInvoiced: line.qtyShipped },
    });
  }

  return tx.salesOrder.update({
    where: { id: order.id },
    data: {
      status: 'invoiced',
      invoicedAt: new Date(),
      accountsInvoiceId: invoice.id,
    },
    include: { lineItems: true },
  });
}

export async function returnSalesOrderLines(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    orderId: string;
    reason?: string;
    userId?: string;
    lines: Array<{ orderLineId: string; qtyReturned: number }>;
  },
) {
  const order = await tx.salesOrder.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    include: { lineItems: true },
  });
  if (!order) throw Object.assign(new Error('ORDER_NOT_FOUND'), { code: 'ORDER_NOT_FOUND' });
  if (!order.facilitySiteId) {
    throw Object.assign(new Error('WAREHOUSE_REQUIRED'), { code: 'WAREHOUSE_REQUIRED' });
  }
  if (order.status !== 'shipped' && order.status !== 'invoiced') {
    throw Object.assign(new Error('ORDER_NOT_RETURNABLE'), { code: 'ORDER_NOT_RETURNABLE' });
  }

  const ret = await tx.salesReturn.create({
    data: {
      organizationId: params.organizationId,
      orderId: order.id,
      reason: params.reason ?? null,
      status: 'completed',
      createdByUserId: params.userId ?? null,
      lines: {
        create: params.lines.map((l) => ({
          organizationId: params.organizationId,
          orderLineId: l.orderLineId,
          qtyReturned: new Prisma.Decimal(l.qtyReturned),
        })),
      },
    },
  });

  for (const item of params.lines) {
    const line = order.lineItems.find((l) => l.id === item.orderLineId);
    if (!line?.productId) continue;
    const base = await qtyToBase(tx, line.productId, line.uom, item.qtyReturned);
    await receiveStock(tx, {
      organizationId: params.organizationId,
      facilitySiteId: order.facilitySiteId,
      productId: line.productId,
      qtyBase: base,
      userId: params.userId,
      notes: `Return from SO-${order.orderNumber}`,
    });
  }

  return ret;
}
