import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessHealthcare, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildNhifOverview } from '@/lib/healthcare/nhif';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessHealthcare(ctx.staff)) {
      return forbiddenResponse('Healthcare access is restricted to operations and admin users.');
    }

    try {
      const { wardCount, assignmentCount, licenseGaps, nhif } = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );

        const [activeWards, upcomingShifts, gaps, nhifOverview] = await Promise.all([
          tx.healthcareWard.count({
            where: { ...ctx.where(), outsourcingClientId: clientId, isActive: true },
          }),
          tx.healthcareClinicalAssignment.count({
            where: {
              ...ctx.where(),
              outsourcingClientId: clientId,
              workDate: { gte: new Date(Date.now() - 7 * 86400000) },
            },
          }),
          tx.healthcareClinicalAssignment.count({
            where: {
              ...ctx.where(),
              outsourcingClientId: clientId,
              licenseOk: false,
              workDate: { gte: new Date() },
            },
          }),
          buildNhifOverview(tx, clientId),
        ]);

        return {
          wardCount: activeWards,
          assignmentCount: upcomingShifts,
          licenseGaps: gaps,
          nhif: nhifOverview,
        };
      });

      return NextResponse.json({
        summary: {
          activeWards: wardCount,
          upcomingClinicalShifts: assignmentCount,
          licenseGaps,
          nhifCompliancePct: nhif.employees.compliancePct,
        },
        nhif,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/healthcare/overview',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load healthcare overview.' }, { status: 500 });
    }
  });
}
