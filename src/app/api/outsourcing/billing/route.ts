import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/** GET /api/outsourcing/billing — invoices for accounts clients linked to end-clients. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    try {
      const limitRaw = request.nextUrl.searchParams.get('limit');
      const limit = Math.min(Math.max(parseInt(limitRaw || '50', 10) || 50, 1), 100);

      const invoices = await ctx.run((tx) =>
        tx.accountsInvoice.findMany({
          where: {
            organizationId: ctx.organizationId,
            accountsClient: { outsourcingClientId: { not: null } },
          },
          orderBy: { issueDate: 'desc' },
          take: limit,
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true,
            dueDate: true,
            currency: true,
            status: true,
            accountsClient: {
              select: {
                id: true,
                name: true,
                outsourcingClientId: true,
                outsourcingClient: { select: { id: true, name: true, status: true } },
              },
            },
            lines: { select: { amountExVat: true } },
          },
        }),
      );

      return NextResponse.json({
        invoices: invoices.map((inv) => {
          const subtotal = inv.lines.reduce((sum, line) => sum + Number(line.amountExVat), 0);
          return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            issueDate: inv.issueDate.toISOString().slice(0, 10),
            dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? null,
            currency: inv.currency,
            status: inv.status,
            subtotal,
            accountsClientId: inv.accountsClient.id,
            accountsClientName: inv.accountsClient.name,
            outsourcingClientId: inv.accountsClient.outsourcingClientId,
            outsourcingClientName: inv.accountsClient.outsourcingClient?.name ?? inv.accountsClient.name,
            outsourcingClientStatus: inv.accountsClient.outsourcingClient?.status ?? null,
          };
        }),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/outsourcing/billing',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load outsourcing billing.' }, { status: 500 });
    }
  });
}
