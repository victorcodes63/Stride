import { NextRequest, NextResponse } from 'next/server';
import { recordAssetAssignmentEvent } from '@/lib/asset-lifecycle';
import { withEssTenant } from '@/lib/ess-tenant-api';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** POST — employee acknowledges receipt of assigned asset (ESS-PLATFORM-SPEC). */
export async function POST(request: NextRequest, context: RouteContext) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) {
      return NextResponse.json({ error: 'Employee session required.' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await context.params;

    const result = await ctx.run(async (tx) => {
      const asset = await tx.companyAsset.findFirst({
        where: ctx.where({
          id,
          assignedEmployeeId: ctx.employeeId!,
          status: 'assigned',
        }),
      });
      if (!asset) {
        return { error: 'Asset not found or not assigned to you.', status: 404 as const };
      }
      if (asset.handoverAcknowledgedAt) {
        return {
          acknowledgedAt: asset.handoverAcknowledgedAt.toISOString(),
          alreadyAcknowledged: true,
        };
      }

      const now = new Date();
      const updated = await tx.companyAsset.update({
        where: { id: asset.id },
        data: { handoverAcknowledgedAt: now },
      });

      await recordAssetAssignmentEvent(tx, {
        organizationId: ctx.organizationId,
        companyAssetId: asset.id,
        eventType: 'acknowledged',
        employeeId: ctx.employeeId,
        performedByUserId: null,
        toStatus: 'assigned',
        notes: 'Handover acknowledged via ESS',
      });

      return { acknowledgedAt: updated.handoverAcknowledgedAt!.toISOString(), alreadyAcknowledged: false };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  });
}
