import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessHealthcare, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildNhifOverview } from '@/lib/healthcare/nhif';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessHealthcare(ctx.staff)) {
      return forbiddenResponse('Healthcare access is restricted to operations and admin users.');
    }

    try {
      const overview = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return buildNhifOverview(tx, clientId);
      });
      return NextResponse.json(overview);
    } catch (error) {
      await reportApiError({
        route: 'GET /api/healthcare/nhif/overview',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load NHIF overview.' }, { status: 500 });
    }
  });
}
