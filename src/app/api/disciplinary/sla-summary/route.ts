import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const cases = await ctx.run((tx) =>
      tx.disciplinaryCase.findMany({
        where: {
          ...ctx.where(),
          employee: { outsourcingClientId: workspaceClientId },
          status: { notIn: ['CLOSED', 'RESOLVED'] },
        },
        select: {
          showCauseResponseDueAt: true,
          hearingAt: true,
          actions: { select: { employeeAcknowledged: true } },
        },
      }),
    );

    const openCases = cases.length;
    const overdueShowCause = cases.filter(
      (c) => c.showCauseResponseDueAt && c.showCauseResponseDueAt < now,
    ).length;
    const hearingsNext7Days = cases.filter(
      (c) => c.hearingAt && c.hearingAt >= now && c.hearingAt <= inSevenDays,
    ).length;
    const pendingAcknowledgments = cases.reduce(
      (sum, c) => sum + c.actions.filter((a) => !a.employeeAcknowledged).length,
      0,
    );

    const openGrievances = await ctx.run((tx) =>
      tx.grievance.count({
        where: {
          ...ctx.where(),
          employee: { outsourcingClientId: workspaceClientId },
          status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATING', 'ESCALATED'] },
        },
      }),
    );

    return NextResponse.json({
      openCases,
      overdueShowCause,
      hearingsNext7Days,
      pendingAcknowledgments,
      openGrievances,
    });
  });
}
