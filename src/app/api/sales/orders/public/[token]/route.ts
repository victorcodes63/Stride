import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { withOrderStatusContext } from '@/lib/sales/order-status-token';

export const dynamic = 'force-dynamic';
type RouteParams = { params: Promise<{ token: string }> };

/** Public partner order status — no staff session required. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  try {
    const resolved = await withOrderStatusContext(token, async ({ tx, orderId, organizationId }) => {
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, organizationId },
        include: {
          accountsClient: { select: { name: true } },
          lineItems: { select: { description: true, qtyOrdered: true, qtyShipped: true, uom: true } },
        },
      });
      if (!order) return { kind: 'not_found' as const };
      return {
        kind: 'ok' as const,
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
      };
    });

    if (!resolved.ok) {
      if (resolved.reason === 'invalid_token') {
        return NextResponse.json({ error: 'Invalid token.' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    if (resolved.result.kind === 'not_found') {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    return NextResponse.json({ order: resolved.result.order });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/sales/orders/public/[token]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load order status.' }, { status: 500 });
  }
}
