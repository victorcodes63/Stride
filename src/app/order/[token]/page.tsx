import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = { title: 'Order status | Stride' };

type PageProps = { params: Promise<{ token: string }> };

export default async function PublicOrderStatusPage({ params }: PageProps) {
  const { token } = await params;
  const order = await prisma.salesOrder.findFirst({
    where: { publicStatusToken: token },
    include: {
      accountsClient: { select: { name: true } },
      lineItems: { select: { description: true, qtyOrdered: true, qtyShipped: true, uom: true } },
    },
  });

  if (!order) {
    return (
      <main style={{ maxWidth: 640, margin: '48px auto', fontFamily: 'system-ui', padding: 24 }}>
        <h1>Order not found</h1>
        <p>This partner status link is invalid or expired.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', fontFamily: 'system-ui', padding: 24 }}>
      <p style={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12, opacity: 0.6 }}>
        Stride partner portal
      </p>
      <h1 style={{ marginTop: 8 }}>SO-{order.orderNumber}</h1>
      <p>
        {order.accountsClient.name} · <strong>{order.status}</strong> · {order.currency}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24 }}>
        <thead>
          <tr>
            <th align="left">Item</th>
            <th align="right">Ordered</th>
            <th align="right">Shipped</th>
          </tr>
        </thead>
        <tbody>
          {order.lineItems.map((l, i) => (
            <tr key={i} style={{ borderTop: '1px solid #ddd' }}>
              <td style={{ padding: '8px 0' }}>{l.description}</td>
              <td align="right">
                {Number(l.qtyOrdered)} {l.uom}
              </td>
              <td align="right">
                {Number(l.qtyShipped)} {l.uom}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
