import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessSacco, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { SASRA_TEMPLATES, buildSasraReport, type SasraTemplateId } from '@/lib/sacco/sasra';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessSacco(ctx.staff)) {
      return forbiddenResponse('SACCO access is restricted to finance and admin users.');
    }

    const templateParam = request.nextUrl.searchParams.get('template')?.trim() ?? 'quarterly_summary';
    if (!(templateParam in SASRA_TEMPLATES)) {
      return NextResponse.json({ error: 'Unknown SASRA template.' }, { status: 400 });
    }

    try {
      const report = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return buildSasraReport(tx, clientId, templateParam as SasraTemplateId);
      });
      return NextResponse.json({ report, templates: SASRA_TEMPLATES });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sacco/reports/sasra',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to build SASRA report.' }, { status: 500 });
    }
  });
}
