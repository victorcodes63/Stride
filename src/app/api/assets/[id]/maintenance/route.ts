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
  resolveMaintenanceUserNames,
} from '@/lib/asset-maintenance-api';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

async function loadAssetScope(
  tx: Prisma.TransactionClient,
  id: string,
  workspaceClientId: string,
  organizationId: string,
) {
  return tx.companyAsset.findFirst({
    where: {
      id,
      outsourcingClientId: workspaceClientId,
      client: { organizationId },
    },
    select: { id: true, status: true, assignedEmployeeId: true },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
      return forbiddenResponse('Asset manager access is restricted to HR and operations.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ items: [] });
    }

    const { id } = await context.params;
    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );
    const asset = await ctx.run((tx) =>
      loadAssetScope(tx, id, workspaceClientId, ctx.organizationId),
    );
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const { records, userNames } = await ctx.run(async (tx) => {
      const rows = await tx.assetMaintenance.findMany({
        where: { companyAssetId: id, organizationId: ctx.organizationId },
        orderBy: [{ scheduledFor: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      });
      return { records: rows, userNames: await resolveMaintenanceUserNames(tx, rows) };
    });

    return NextResponse.json({ items: records.map((r) => maintenanceToResponse(r, userNames)) });
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
      return forbiddenResponse('Asset manager access is restricted to HR and operations.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await context.params;
    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );
    const asset = await ctx.run((tx) =>
      loadAssetScope(tx, id, workspaceClientId, ctx.organizationId),
    );
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const title = asOptionalString(body.title);
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    const type = parseMaintenanceType(body.type);
    const status = parseMaintenanceStatus(body.status) ?? 'scheduled';
    const completedAt =
      status === 'completed' ? (asDate(body.completedAt) ?? new Date()) : null;
    const nextDueAt = asDate(body.nextDueAt);

    const created = await ctx.run(async (tx) => {
      const record = await tx.assetMaintenance.create({
        data: {
          organizationId: ctx.organizationId,
          companyAssetId: id,
          type,
          status,
          title,
          description: asOptionalString(body.description) ?? undefined,
          vendor: asOptionalString(body.vendor) ?? undefined,
          cost: asOptionalDecimal(body.cost) ?? undefined,
          scheduledFor: asDate(body.scheduledFor) ?? undefined,
          completedAt: completedAt ?? undefined,
          nextDueAt: nextDueAt ?? undefined,
          createdByUserId: ctx.staff.id,
          performedByUserId: status === 'completed' ? ctx.staff.id : undefined,
        },
      });

      // Keep the asset's denormalised maintenance rollups + status in sync.
      const assetData: Prisma.CompanyAssetUpdateInput = {};
      if (status === 'completed') {
        assetData.lastMaintenanceAt = completedAt ?? new Date();
        if (nextDueAt) assetData.nextMaintenanceAt = nextDueAt;
        if (asset.status === 'maintenance') {
          assetData.status = asset.assignedEmployeeId ? 'assigned' : 'available';
        }
      } else if ((status === 'scheduled' || status === 'in_progress') && nextDueAt) {
        assetData.nextMaintenanceAt = nextDueAt;
      }
      if (status === 'in_progress' && asset.status === 'available') {
        assetData.status = 'maintenance';
      }
      if (Object.keys(assetData).length > 0) {
        await tx.companyAsset.update({ where: { id }, data: assetData });
      }

      return record;
    });

    await ctx.audit({
      action: 'asset.maintenance.created',
      entityType: 'AssetMaintenance',
      entityId: created.id,
      route: 'POST /api/assets/[id]/maintenance',
      metadata: { companyAssetId: id, type, status },
    });

    return NextResponse.json(maintenanceToResponse(created), { status: 201 });
  });
}
