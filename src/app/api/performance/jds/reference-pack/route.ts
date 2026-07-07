import { NextRequest, NextResponse } from 'next/server';

import { isDemoMode } from '@/lib/deployment-flags';
import { importStabexReferencePack } from '@/lib/performance/jd/service';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json(
      { error: 'Demo reference pack import is disabled on production deployments.' },
      { status: 403 },
    );
  }

  return withTenant(
    request,
    async (ctx) => {
      const body = (await request.json().catch(() => ({}))) as { replaceExisting?: boolean };

      const result = await ctx.run((tx) =>
        importStabexReferencePack(tx, {
          organizationId: ctx.organizationId,
          createdByUserId: ctx.staff.id,
          replaceExisting: Boolean(body.replaceExisting),
        }),
      );

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      await ctx.audit({
        action: 'performance.jd.reference_pack.imported',
        entityType: 'JobDescription',
        route: 'POST /api/performance/jds/reference-pack',
        metadata: {
          packName: result.packName,
          divisionCount: result.divisionCount,
          roleCount: result.roleCount,
        },
      });

      return NextResponse.json(result);
    },
    { adminOnly: true },
  );
}
