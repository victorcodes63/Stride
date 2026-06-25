import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { buildProjectBudgetReport } from '@/lib/projects/project-budget';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const status = request.nextUrl.searchParams.get('status')?.trim() || 'active';

    const projects = await prisma.project.findMany({
      where: {
        outsourcingClientId: clientId,
        ...(status && status !== 'all' ? { status: status as never } : {}),
      },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const reports = [];
    for (const p of projects) {
      const report = await buildProjectBudgetReport(prisma, {
        projectId: p.id,
        outsourcingClientId: clientId,
      });
      if (report) reports.push(report);
    }

    reports.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

    return NextResponse.json({ reports });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/projects/budget-summary',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load budget summary.' }, { status: 500 });
  }
}
