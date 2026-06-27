import { NextRequest, NextResponse } from 'next/server';
import type { AssetStatus, Prisma } from '@prisma/client';
import {
  canAccessAssets,
  forbiddenResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';
import {
  ASSET_STATUSES,
  asDate,
  asOptionalDecimal,
  asOptionalString,
  assetInclude,
  assetToResponse,
  parseAssetCategory,
  parseAssetStatus,
} from '@/lib/assets-api';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

async function loadAsset(
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
    include: assetInclude,
  });
}

async function findWorkspaceEmployee(
  tx: Prisma.TransactionClient,
  employeeId: string,
  workspaceClientId: string,
  organizationId: string,
) {
  return tx.employee.findFirst({
    where: {
      id: employeeId,
      outsourcingClientId: workspaceClientId,
      client: { organizationId },
    },
    select: { id: true, outsourcingClientId: true },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
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
    const record = await ctx.run((tx) =>
      loadAsset(tx, id, workspaceClientId, ctx.organizationId),
    );
    if (!record) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    return NextResponse.json(assetToResponse(record));
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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
    const existing = await ctx.run((tx) =>
      loadAsset(tx, id, workspaceClientId, ctx.organizationId),
    );
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const action = asOptionalString(body.action);
    let assignedEmployeeId = existing.assignedEmployeeId;
    let assignedAt = existing.assignedAt;
    let assignedByUserId = existing.assignedByUserId;
    let status: AssetStatus = existing.status;

    if (action === 'assign') {
      const employeeId = asOptionalString(body.employeeId);
      if (!employeeId) {
        return NextResponse.json({ error: 'employeeId is required to assign' }, { status: 400 });
      }
      const employee = await ctx.run((tx) =>
        findWorkspaceEmployee(tx, employeeId, workspaceClientId, ctx.organizationId),
      );
      if (!employee || employee.outsourcingClientId !== workspaceClientId) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      assignedEmployeeId = employeeId;
      assignedAt = new Date();
      assignedByUserId = ctx.staff.id;
      status = 'assigned';
    } else if (action === 'return') {
      assignedEmployeeId = null;
      assignedAt = null;
      assignedByUserId = null;
      status = 'available';
    } else if ('assignedEmployeeId' in body) {
      const employeeId = asOptionalString(body.assignedEmployeeId);
      if (employeeId) {
        const employee = await ctx.run((tx) =>
          findWorkspaceEmployee(tx, employeeId, workspaceClientId, ctx.organizationId),
        );
        if (!employee || employee.outsourcingClientId !== workspaceClientId) {
          return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }
        assignedEmployeeId = employeeId;
        assignedAt = new Date();
        assignedByUserId = ctx.staff.id;
        status = 'assigned';
      } else {
        assignedEmployeeId = null;
        assignedAt = null;
        assignedByUserId = null;
        if (status === 'assigned') status = 'available';
      }
    }

    if ('status' in body) {
      const next = parseAssetStatus(body.status);
      if (ASSET_STATUSES.has(next)) status = next;
      if (next !== 'assigned' && !assignedEmployeeId) {
        /* keep unassigned statuses */
      } else if (next !== 'assigned' && assignedEmployeeId && action !== 'assign') {
        assignedEmployeeId = null;
        assignedAt = null;
        assignedByUserId = null;
      }
    }

    try {
      const updated = await ctx.run((tx) =>
        tx.companyAsset.update({
          where: { id },
          data: {
            ...(body.assetTag !== undefined ? { assetTag: asOptionalString(body.assetTag) ?? existing.assetTag } : {}),
            ...(body.name !== undefined ? { name: asOptionalString(body.name) ?? existing.name } : {}),
            ...(body.description !== undefined
              ? { description: asOptionalString(body.description) }
              : {}),
            ...(body.category !== undefined ? { category: parseAssetCategory(body.category) } : {}),
            status,
            ...(body.serialNumber !== undefined ? { serialNumber: asOptionalString(body.serialNumber) } : {}),
            ...(body.manufacturer !== undefined ? { manufacturer: asOptionalString(body.manufacturer) } : {}),
            ...(body.model !== undefined ? { model: asOptionalString(body.model) } : {}),
            ...(body.purchaseDate !== undefined ? { purchaseDate: asDate(body.purchaseDate) } : {}),
            ...(body.purchaseCost !== undefined ? { purchaseCost: asOptionalDecimal(body.purchaseCost) } : {}),
            ...(body.warrantyExpiry !== undefined ? { warrantyExpiry: asDate(body.warrantyExpiry) } : {}),
            ...(body.location !== undefined ? { location: asOptionalString(body.location) } : {}),
            ...(body.notes !== undefined ? { notes: asOptionalString(body.notes) } : {}),
            assignedEmployeeId,
            assignedAt,
            assignedByUserId,
          },
          include: assetInclude,
        }),
      );

      await ctx.audit({
        action: action === 'assign' ? 'asset.assigned' : action === 'return' ? 'asset.returned' : 'asset.updated',
        entityType: 'CompanyAsset',
        entityId: updated.id,
        route: 'PATCH /api/assets/[id]',
        metadata: { assetTag: updated.assetTag, status: updated.status },
      });

      return NextResponse.json(assetToResponse(updated));
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return NextResponse.json({ error: 'Asset tag already exists' }, { status: 409 });
      }
      throw error;
    }
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

    const { id } = await context.params;
    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );
    const existing = await ctx.run((tx) =>
      loadAsset(tx, id, workspaceClientId, ctx.organizationId),
    );
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    await ctx.run((tx) => tx.companyAsset.delete({ where: { id } }));
    await ctx.audit({
      action: 'asset.deleted',
      entityType: 'CompanyAsset',
      entityId: id,
      route: 'DELETE /api/assets/[id]',
      metadata: { assetTag: existing.assetTag },
    });

    return NextResponse.json({ success: true });
  });
}
