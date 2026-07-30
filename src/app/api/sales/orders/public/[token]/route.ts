import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';
type RouteParams = { params: Promise<{ token: string }> };

/** Public partner order status — no staff session required. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 });
  }
  try {
    const order = await prisma.salesOrder.findFirst({
      where: { publicStatusToken: token },
      include: {
        accountsClient: { select: { name: true } },
        lineItems: { select: { description: true, qtyOrdered: true, qtyShipped: true, uom: true } },
      },
    });
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    return NextResponse.json({
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        customerName: order.accountsClient.name,
        currency: order.currency,
        confirmedAt: order.confirmedAt?.toISOString() ?? null,
        shippedAt: order.shippedAt?.toISOString() ?? null,
        invoicedAt: order.invoicedAt?.toISOString() ?? null,
        lines: order.lineItems.map((l) => ({
          description: l.description,
          uom: l.uom,
          qtyOrdered: Number(l.qtyOrdered),
          qtyShipped: Number(l.qtyShipped),
        })),
      },
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/sales/orders/public/[token]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load order status.' }, { status: 500 });
  }
}
