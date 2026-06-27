import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/** Read-only vendor picker for purchase requests (master data lives in Finance). */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    try {
      const vendors = await ctx.run((tx) =>
        tx.accountsVendor.findMany({
          where: ctx.where(),
          select: { id: true, name: true, currency: true },
          orderBy: { name: 'asc' },
          take: 500,
        }),
      );
      return NextResponse.json({ vendors });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/procurement/vendors',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load vendors.' }, { status: 500 });
    }
  });
}
