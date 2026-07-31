import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const modules = getEffectiveModulesFromRequest(request);
    const invBlock = requireModule('inventory', modules);
    const salesBlock = requireModule('sales', modules);
    if (invBlock && salesBlock) return invBlock;

    try {
      const sites = await ctx.run((tx) =>
        tx.facilitySite.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: 'active',
            OR: [{ siteType: 'warehouse' }, { siteType: 'other' }],
          },
          select: { id: true, name: true, siteCode: true, siteType: true, address: true },
          orderBy: { name: 'asc' },
          take: 100,
        }),
      );
      return NextResponse.json({ sites });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/inventory/sites',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load sites.' }, { status: 500 });
    }
  });
}
