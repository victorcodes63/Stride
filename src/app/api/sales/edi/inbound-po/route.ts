import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { nextSalesOrderNumber } from '@/lib/sales/order-lifecycle';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const lines = Array.isArray(body.lines) ? (body.lines as Record<string, unknown>[]) : [];
    if (lines.length === 0) {
      return NextResponse.json({ error: 'lines required.' }, { status: 400 });
    }
    try {
      const result = await ctx.run(async (tx) => {
        const clientId =
          typeof body.customerCodeOrClientId === 'string' ? body.customerCodeOrClientId.trim() : '';
        let client = await tx.accountsClient.findFirst({
          where: { organizationId: ctx.organizationId, id: clientId },
        });
        if (!client) {
          client = await tx.accountsClient.findFirst({
            where: { organizationId: ctx.organizationId, outletCode: clientId },
          });
        }
        if (!client) throw Object.assign(new Error('CLIENT_NOT_FOUND'), { code: 'CLIENT_NOT_FOUND' });

        const resolvedLines = [];
        for (const l of lines) {
          let productId = typeof l.productId === 'string' ? l.productId : null;
          if (!productId && typeof l.sku === 'string') {
            const p = await tx.salesProduct.findFirst({
              where: { organizationId: ctx.organizationId, sku: l.sku },
            });
            productId = p?.id ?? null;
          }
          resolvedLines.push({
            productId,
            description: String(l.description || l.sku || 'EDI line'),
            uom: typeof l.uom === 'string' ? l.uom : 'each',
            qtyOrdered: Number(l.qty) || 0,
            unitPrice: Number(l.unitPrice) || 0,
          });
        }

        const orderNumber = await nextSalesOrderNumber(tx, ctx.organizationId);
        const order = await tx.salesOrder.create({
          data: {
            organizationId: ctx.organizationId,
            orderNumber,
            status: 'draft',
            accountsClientId: client.id,
            currency: typeof body.currency === 'string' ? body.currency : client.currency,
            notes: typeof body.reference === 'string' ? `EDI PO ${body.reference}` : 'EDI inbound PO',
            createdByUserId: ctx.staff.id,
            lineItems: {
              create: resolvedLines.map((l, i) => ({
                organizationId: ctx.organizationId,
                productId: l.productId,
                description: l.description,
                uom: l.uom,
                qtyOrdered: new Prisma.Decimal(l.qtyOrdered),
                unitPrice: new Prisma.Decimal(l.unitPrice),
                sortOrder: i,
              })),
            },
          },
        });

        const edi = await tx.salesEdiMessage.create({
          data: {
            organizationId: ctx.organizationId,
            direction: 'inbound',
            messageType: 'po',
            status: 'processed',
            payload: body as Prisma.InputJsonValue,
            salesOrderId: order.id,
          },
        });

        return { orderId: order.id, orderNumber: order.orderNumber, ediMessageId: edi.id };
      });
      return NextResponse.json({ result }, { status: 201 });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'CLIENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Customer/client not found.' }, { status: 404 });
      }
      await reportApiError({
        route: 'POST /api/sales/edi/inbound-po',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to ingest EDI PO.' }, { status: 500 });
    }
  });
}
