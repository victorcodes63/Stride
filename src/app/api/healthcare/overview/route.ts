import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessHealthcare, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildNhifOverview } from '@/lib/healthcare/nhif';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessHealthcare(user)) {
    return forbiddenResponse('Healthcare access is restricted to operations and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);

    const [wardCount, assignmentCount, licenseGaps, nhif] = await Promise.all([
      prisma.healthcareWard.count({ where: { outsourcingClientId: clientId, isActive: true } }),
      prisma.healthcareClinicalAssignment.count({
        where: { outsourcingClientId: clientId, workDate: { gte: new Date(Date.now() - 7 * 86400000) } },
      }),
      prisma.healthcareClinicalAssignment.count({
        where: { outsourcingClientId: clientId, licenseOk: false, workDate: { gte: new Date() } },
      }),
      buildNhifOverview(prisma, clientId),
    ]);

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
}
