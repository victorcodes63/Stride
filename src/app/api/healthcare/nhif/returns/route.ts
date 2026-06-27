import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessHealthcare, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildNhifReturnExtract } from '@/lib/healthcare/nhif';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessHealthcare(ctx.staff)) {
      return forbiddenResponse('Healthcare access is restricted to operations and admin users.');
    }

    const month =
      request.nextUrl.searchParams.get('month')?.trim() ??
      new Date().toISOString().slice(0, 7);

    try {
      const extract = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return buildNhifReturnExtract(tx, clientId, month);
      });
      return NextResponse.json({ extract });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/healthcare/nhif/returns',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to build NHIF return extract.' }, { status: 500 });
    }
  });
}
