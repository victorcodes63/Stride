import { NextRequest, NextResponse } from 'next/server';
import { canAccessEnergy, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildEnergyHseRollup } from '@/lib/energy/hse-rollup';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessEnergy(ctx.staff)) {
      return forbiddenResponse('Energy access is restricted to operations and admin users.');
    }

    try {
      const rollup = await ctx.run((tx) => buildEnergyHseRollup(tx, ctx.organizationId));
      return NextResponse.json({ rollup });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/energy/hse/rollup',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load HSE rollup.' }, { status: 500 });
    }
  });
}
