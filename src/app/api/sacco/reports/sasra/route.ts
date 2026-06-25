import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessSacco, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { SASRA_TEMPLATES, buildSasraReport, type SasraTemplateId } from '@/lib/sacco/sasra';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessSacco(user)) {
    return forbiddenResponse('SACCO access is restricted to finance and admin users.');
  }

  const templateParam = request.nextUrl.searchParams.get('template')?.trim() ?? 'quarterly_summary';
  if (!(templateParam in SASRA_TEMPLATES)) {
    return NextResponse.json({ error: 'Unknown SASRA template.' }, { status: 400 });
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const report = await buildSasraReport(
      prisma,
      clientId,
      templateParam as SasraTemplateId,
    );
    return NextResponse.json({ report, templates: SASRA_TEMPLATES });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/sacco/reports/sasra',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to build SASRA report.' }, { status: 500 });
  }
}
