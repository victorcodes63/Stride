import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { buildProjectBudgetReport } from '@/lib/projects/project-budget';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const report = await buildProjectBudgetReport(prisma, {
      projectId: id,
      outsourcingClientId: clientId,
    });
    if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ report });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/projects/[id]/budget',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load project budget.' }, { status: 500 });
  }
}
