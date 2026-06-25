import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessConstruction, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessConstruction(user)) {
    return forbiddenResponse('Construction access is restricted to operations and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);

    const [activeSites, plantOnSite, activeSubcontractors, subcontractorExposure] =
      await Promise.all([
        prisma.constructionSite.count({
          where: { outsourcingClientId: clientId, status: 'active' },
        }),
        prisma.constructionPlantAsset.count({
          where: { outsourcingClientId: clientId, status: 'on_site' },
        }),
        prisma.constructionSubcontractor.count({
          where: { outsourcingClientId: clientId, status: 'active' },
        }),
        prisma.constructionSubcontractor.aggregate({
          where: { outsourcingClientId: clientId, status: 'active' },
          _sum: { amountInvoiced: true, amountPaid: true },
        }),
      ]);

    const invoiced = Number(subcontractorExposure._sum.amountInvoiced ?? 0);
    const paid = Number(subcontractorExposure._sum.amountPaid ?? 0);

    return NextResponse.json({
      summary: {
        activeSites,
        plantOnSite,
        activeSubcontractors,
        subcontractorInvoiced: invoiced,
        subcontractorPaid: paid,
        subcontractorOutstanding: Math.max(0, invoiced - paid),
      },
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/construction/overview',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load construction overview.' }, { status: 500 });
  }
}
