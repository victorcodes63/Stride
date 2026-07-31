import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { availableToPromise } from '@/lib/inventory/atp';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('inventory', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;
    const facilitySiteId = request.nextUrl.searchParams.get('facilitySiteId')?.trim() || undefined;
    try {
      const rows = await ctx.run((tx) =>
        tx.inventoryStock.findMany({
          where: {
            organizationId: ctx.organizationId,
            ...(facilitySiteId ? { facilitySiteId } : {}),
          },
          include: {
            product: { select: { id: true, name: true, sku: true, baseUom: true } },
            facilitySite: { select: { id: true, name: true, siteCode: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 500,
        }),
      );
      return NextResponse.json({
        stock: rows.map((r) => ({
          id: r.id,
          facilitySiteId: r.facilitySiteId,
          facilitySiteName: r.facilitySite.name,
          productId: r.productId,
          productName: r.product.name,
          sku: r.product.sku,
          baseUom: r.product.baseUom,
          qtyOnHand: Number(r.qtyOnHand),
          qtyReserved: Number(r.qtyReserved),
          atp: availableToPromise(r),
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/inventory/stock',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load stock.' }, { status: 500 });
    }
  });
}
