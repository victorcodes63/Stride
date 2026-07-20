import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { canAccessAssets, forbiddenResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const EMPTY_SUMMARY = {
  total: 0,
  assigned: 0,
  available: 0,
  maintenance: 0,
  retired: 0,
  lost: 0,
  warrantyExpiring: 0,
  handoverPending: 0,
  maintenanceDue: 0,
};

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
      return forbiddenResponse('Asset manager access is restricted to HR and operations.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(EMPTY_SUMMARY);
    }

    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );

    const baseWhere: Prisma.CompanyAssetWhereInput = {
      outsourcingClientId: workspaceClientId,
      client: { organizationId: ctx.organizationId },
    };

    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 30);

    const summary = await ctx.run(async (tx) => {
      const grouped = await tx.companyAsset.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      });
      const warrantyExpiring = await tx.companyAsset.count({
        where: {
          ...baseWhere,
          warrantyExpiry: { gte: now, lte: horizon },
          status: { notIn: ['retired', 'lost'] },
        },
      });
      const handoverPending = await tx.companyAsset.count({
        where: {
          ...baseWhere,
          status: 'assigned',
          assignedEmployeeId: { not: null },
          handoverAcknowledgedAt: null,
        },
      });
      const maintenanceDue = await tx.companyAsset.count({
        where: {
          ...baseWhere,
          nextMaintenanceAt: { not: null, lte: horizon },
          status: { notIn: ['retired', 'lost'] },
        },
      });

      const byStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
      const total = grouped.reduce((acc, g) => acc + g._count._all, 0);

      return {
        total,
        assigned: byStatus.get('assigned') ?? 0,
        available: byStatus.get('available') ?? 0,
        maintenance: byStatus.get('maintenance') ?? 0,
        retired: byStatus.get('retired') ?? 0,
        lost: byStatus.get('lost') ?? 0,
        warrantyExpiring,
        handoverPending,
        maintenanceDue,
      };
    });

    return NextResponse.json(summary);
  });
}
