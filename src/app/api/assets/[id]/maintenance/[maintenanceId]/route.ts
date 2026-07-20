import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { canAccessAssets, forbiddenResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';
import { asDate, asOptionalDecimal, asOptionalString } from '@/lib/assets-api';
import {
  maintenanceToResponse,
  parseMaintenanceStatus,
  parseMaintenanceType,
} from '@/lib/asset-maintenance-api';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; maintenanceId: string }> };

async function loadScope(
  tx: Prisma.TransactionClient,
  assetId: string,
  maintenanceId: string,
  workspaceClientId: string,
  organizationId: string,
) {
  const asset = await tx.companyAsset.findFirst({
    where: {
      id: assetId,
      outsourcingClientId: workspaceClientId,
      client: { organizationId },
    },
    select: { id: true, status: true, assignedEmployeeId: true },
  });
  if (!asset) return { asset: null, record: null };
  const record = await tx.assetMaintenance.findFirst({
    where: { id: maintenanceId, companyAssetId: assetId, organizationId },
  });
  return { asset, record };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
      return forbiddenResponse('Asset manager access is restricted to HR and operations.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id, maintenanceId } = await context.params;
    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );
    const { asset, record } = await ctx.run((tx) =>
      loadScope(tx, id, maintenanceId, workspaceClientId, ctx.organizationId),
    );
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    if (!record) return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const nextStatus = parseMaintenanceStatus(body.status);
    const status = nextStatus ?? record.status;
    const nextDueAt = body.nextDueAt !== undefined ? asDate(body.nextDueAt) : record.nextDueAt;
    const becomingCompleted = status === 'completed' && record.status !== 'completed';
    const completedAt =
      status === 'completed'
        ? (asDate(body.completedAt) ?? record.completedAt ?? new Date())
        : null;

    const updated = await ctx.run(async (tx) => {
      const data: Prisma.AssetMaintenanceUpdateInput = {
        status,
        completedAt,
        ...(body.type !== undefined ? { type: parseMaintenanceType(body.type) } : {}),
        ...(body.title !== undefined
          ? { title: asOptionalString(body.title) ?? record.title }
          : {}),
        ...(body.description !== undefined
          ? { description: asOptionalString(body.description) }
          : {}),
        ...(body.vendor !== undefined ? { vendor: asOptionalString(body.vendor) } : {}),
        ...(body.cost !== undefined ? { cost: asOptionalDecimal(body.cost) } : {}),
        ...(body.scheduledFor !== undefined ? { scheduledFor: asDate(body.scheduledFor) } : {}),
        ...(body.nextDueAt !== undefined ? { nextDueAt } : {}),
        ...(becomingCompleted ? { performedByUserId: ctx.staff.id } : {}),
      };

      const result = await tx.assetMaintenance.update({
        where: { id: maintenanceId },
        data,
      });

      const assetData: Prisma.CompanyAssetUpdateInput = {};
      if (becomingCompleted) {
        assetData.lastMaintenanceAt = completedAt ?? new Date();
        if (nextDueAt) assetData.nextMaintenanceAt = nextDueAt;
        if (asset.status === 'maintenance') {
          assetData.status = asset.assignedEmployeeId ? 'assigned' : 'available';
        }
      } else if (status === 'in_progress' && asset.status === 'available') {
        assetData.status = 'maintenance';
      }
      if (Object.keys(assetData).length > 0) {
        await tx.companyAsset.update({ where: { id }, data: assetData });
      }

      return result;
    });

    await ctx.audit({
      action: becomingCompleted ? 'asset.maintenance.completed' : 'asset.maintenance.updated',
      entityType: 'AssetMaintenance',
      entityId: maintenanceId,
      route: 'PATCH /api/assets/[id]/maintenance/[maintenanceId]',
      metadata: { companyAssetId: id, status },
    });

    return NextResponse.json(maintenanceToResponse(updated));
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
      return forbiddenResponse('Asset manager access is restricted to HR and operations.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id, maintenanceId } = await context.params;
    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );
    const { asset, record } = await ctx.run((tx) =>
      loadScope(tx, id, maintenanceId, workspaceClientId, ctx.organizationId),
    );
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    if (!record) return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 });

    await ctx.run((tx) => tx.assetMaintenance.delete({ where: { id: maintenanceId } }));

    await ctx.audit({
      action: 'asset.maintenance.deleted',
      entityType: 'AssetMaintenance',
      entityId: maintenanceId,
      route: 'DELETE /api/assets/[id]/maintenance/[maintenanceId]',
      metadata: { companyAssetId: id },
    });

    return NextResponse.json({ success: true });
  });
}
