import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { nextSalesOrderNumber } from '@/lib/sales/order-lifecycle';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

function mapOrder(o: {
  id: string;
  orderNumber: number;
  status: string;
  currency: string;
  accountsClientId: string;
  facilitySiteId: string | null;
  dealId: string | null;
  quoteId: string | null;
  confirmedAt: Date | null;
  shippedAt: Date | null;
  invoicedAt: Date | null;
  createdAt: Date;
  accountsClient?: { id: string; name: string } | null;
  lineItems?: unknown[];
  _count?: { lineItems: number };
}) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    currency: o.currency,
    accountsClientId: o.accountsClientId,
    accountsClientName: o.accountsClient?.name ?? null,
    facilitySiteId: o.facilitySiteId,
    dealId: o.dealId,
    quoteId: o.quoteId,
    lineCount: o._count?.lineItems ?? o.lineItems?.length ?? 0,
    confirmedAt: o.confirmedAt?.toISOString() ?? null,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    invoicedAt: o.invoicedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    try {
      const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
      const orders = await ctx.run((tx) =>
        tx.salesOrder.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(status ? { status } : {}),
          },
          include: {
            accountsClient: { select: { id: true, name: true } },
            _count: { select: { lineItems: true } },
          },
          orderBy: { orderNumber: 'desc' },
          take: 200,
        }),
      );
      return NextResponse.json({ orders: orders.map(mapOrder) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/orders',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load orders.' }, { status: 500 });
    }
  });
}

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

    const accountsClientId =
      typeof body.accountsClientId === 'string' ? body.accountsClientId.trim() : '';
    if (!accountsClientId) {
      return NextResponse.json({ error: 'accountsClientId is required.' }, { status: 400 });
    }

    try {
      const order = await ctx.run(async (tx) => {
        const client = await tx.accountsClient.findFirst({
          where: { id: accountsClientId, organizationId: ctx.organizationId },
        });
        if (!client) throw Object.assign(new Error('CLIENT_NOT_FOUND'), { code: 'CLIENT_NOT_FOUND' });

        let lines = Array.isArray(body.lines) ? (body.lines as Record<string, unknown>[]) : [];
        const quoteId = typeof body.quoteId === 'string' ? body.quoteId : null;
        const dealId = typeof body.dealId === 'string' ? body.dealId : null;

        if (lines.length === 0 && quoteId) {
          const quote = await tx.salesQuote.findFirst({
            where: { id: quoteId, organizationId: ctx.organizationId },
            include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
          });
          if (quote) {
            lines = quote.lineItems.map((li) => ({
              productId: li.productId,
              description: li.description,
              uom: 'each',
              qtyOrdered: Number(li.quantity),
              unitPrice: Number(li.unitPrice),
              discountPct: Number(li.discountPct),
            }));
          }
        }

        if (lines.length === 0 && dealId) {
          const deal = await tx.salesDeal.findFirst({
            where: { id: dealId, organizationId: ctx.organizationId },
            include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
          });
          if (deal) {
            lines = deal.lineItems.map((li) => ({
              productId: li.productId,
              description: li.description,
              uom: 'each',
              qtyOrdered: Number(li.quantity),
              unitPrice: Number(li.unitPrice),
              discountPct: Number(li.discountPct),
            }));
          }
        }

        const orderNumber = await nextSalesOrderNumber(tx, ctx.organizationId);
        return tx.salesOrder.create({
          data: {
            organizationId: ctx.organizationId,
            orderNumber,
            status: 'draft',
            accountsClientId,
            dealId,
            quoteId,
            facilitySiteId: typeof body.facilitySiteId === 'string' ? body.facilitySiteId : null,
            priceBookId: typeof body.priceBookId === 'string' ? body.priceBookId : null,
            currency: typeof body.currency === 'string' ? body.currency : client.currency || 'KES',
            notes: typeof body.notes === 'string' ? body.notes : null,
            createdByUserId: ctx.staff.id,
            lineItems: {
              create: lines.map((l, i) => ({
                organizationId: ctx.organizationId,
                productId: typeof l.productId === 'string' ? l.productId : null,
                description: String(l.description || 'Line').trim() || 'Line',
                uom: typeof l.uom === 'string' && l.uom.trim() ? l.uom.trim() : 'each',
                qtyOrdered: new Prisma.Decimal(Number(l.qtyOrdered) || 0),
                unitPrice: new Prisma.Decimal(Number(l.unitPrice) || 0),
                discountPct: new Prisma.Decimal(Number(l.discountPct) || 0),
                sortOrder: i,
              })),
            },
          },
          include: {
            accountsClient: { select: { id: true, name: true } },
            lineItems: true,
          },
        });
      });

      return NextResponse.json(
        {
          order: {
            ...mapOrder(order),
            lineItems: order.lineItems.map((l) => ({
              id: l.id,
              productId: l.productId,
              description: l.description,
              uom: l.uom,
              qtyOrdered: Number(l.qtyOrdered),
              qtyReserved: Number(l.qtyReserved),
              qtyShipped: Number(l.qtyShipped),
              qtyInvoiced: Number(l.qtyInvoiced),
              unitPrice: Number(l.unitPrice),
              discountPct: Number(l.discountPct),
            })),
          },
        },
        { status: 201 },
      );
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'CLIENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
      }
      await reportApiError({
        route: 'POST /api/sales/orders',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create order.' }, { status: 500 });
    }
  });
}
