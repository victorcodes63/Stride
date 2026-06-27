import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { buildLpoPdf } from '@/lib/procurement/lpo-pdf';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;

    try {
      const row = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        return tx.purchaseOrder.findFirst({
          where: { ...ctx.where(), id, outsourcingClientId: clientId },
          include: {
            lines: { orderBy: { sortOrder: 'asc' } },
            vendor: { select: { name: true } },
            client: { select: { name: true } },
            purchaseRequest: { select: { requestNumber: true } },
          },
        });
      });

      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const pdf = await buildLpoPdf({
        lpoNumber: row.lpoNumber,
        title: row.title,
        clientName: row.client.name,
        vendorName: row.vendor.name,
        currency: row.currency,
        status: row.status,
        issuedAt: row.issuedAt?.toISOString() ?? null,
        purchaseRequestNumber: row.purchaseRequest?.requestNumber ?? null,
        lines: row.lines.map((line) => ({
          item: line.item,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        })),
      });

      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${row.lpoNumber}.pdf"`,
        },
      });
    } catch (error) {
      await reportApiError({
        route: `GET /api/procurement/purchase-orders/${id}/pdf`,
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to generate LPO PDF.' }, { status: 500 });
    }
  });
}
