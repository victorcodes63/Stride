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
  asOptionalInt,
  asOptionalString,
  assetInclude,
  assetToResponse,
  generateAssetQrToken,
  parseAssetCategory,
  parseAssetStatus,
} from '@/lib/assets-api';
import { parseDepreciationMethod } from '@/lib/asset-depreciation';
import { recordAssetAssignmentEvent } from '@/lib/asset-lifecycle';

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
    let handoverAcknowledgedAt = existing.handoverAcknowledgedAt;
    let status: AssetStatus = existing.status;
    let handoverNotes = existing.handoverNotes;
    let lifecycleEvent:
      | {
          eventType: 'assigned' | 'returned' | 'transferred' | 'status_changed' | 'acknowledged';
          employeeId?: string | null;
          fromEmployeeId?: string | null;
          fromStatus?: AssetStatus;
          toStatus?: AssetStatus;
          notes?: string | null;
        }
      | null = null;

    if (action === 'acknowledge') {
      if (existing.status !== 'assigned' || !existing.assignedEmployeeId) {
        return NextResponse.json(
          { error: 'Only an assigned asset can be acknowledged.' },
          { status: 400 },
        );
      }
      handoverAcknowledgedAt = new Date();
      lifecycleEvent = {
        eventType: 'acknowledged',
        employeeId: existing.assignedEmployeeId,
        toStatus: 'assigned',
        notes: asOptionalString(body.notes),
      };
    } else if (action === 'assign') {
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
      const previousEmployeeId = assignedEmployeeId;
      assignedEmployeeId = employeeId;
      assignedAt = new Date();
      assignedByUserId = ctx.staff.id;
      handoverAcknowledgedAt = null;
      status = 'assigned';
      lifecycleEvent = {
        eventType: previousEmployeeId && previousEmployeeId !== employeeId ? 'transferred' : 'assigned',
        employeeId,
        fromEmployeeId: previousEmployeeId,
        fromStatus: existing.status,
        toStatus: 'assigned',
      };
    } else if (action === 'return') {
      lifecycleEvent = {
        eventType: 'returned',
        employeeId: assignedEmployeeId,
        fromStatus: existing.status,
        toStatus: 'available',
      };
      assignedEmployeeId = null;
      assignedAt = null;
      assignedByUserId = null;
      handoverAcknowledgedAt = null;
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
        handoverAcknowledgedAt = null;
        status = 'assigned';
        lifecycleEvent = {
          eventType:
            existing.assignedEmployeeId && existing.assignedEmployeeId !== employeeId
              ? 'transferred'
              : 'assigned',
          employeeId,
          fromEmployeeId: existing.assignedEmployeeId,
          fromStatus: existing.status,
          toStatus: 'assigned',
        };
      } else {
        if (assignedEmployeeId) {
          lifecycleEvent = {
            eventType: 'returned',
            employeeId: assignedEmployeeId,
            fromStatus: existing.status,
            toStatus: 'available',
          };
        }
        assignedEmployeeId = null;
        assignedAt = null;
        assignedByUserId = null;
        handoverAcknowledgedAt = null;
        if (status === 'assigned') status = 'available';
      }
    }

    if ('handoverNotes' in body) {
      handoverNotes = asOptionalString(body.handoverNotes);
    }

    if ('status' in body) {
      const next = parseAssetStatus(body.status);
      if (ASSET_STATUSES.has(next) && next !== status) {
        if (!lifecycleEvent) {
          lifecycleEvent = {
            eventType: 'status_changed',
            fromStatus: status,
            toStatus: next,
            notes: asOptionalString(body.notes),
          };
        }
        status = next;
      }
      if (next !== 'assigned' && !assignedEmployeeId) {
        /* keep unassigned statuses */
      } else if (next !== 'assigned' && assignedEmployeeId && action !== 'assign') {
        if (!lifecycleEvent) {
          lifecycleEvent = {
            eventType: 'returned',
            employeeId: assignedEmployeeId,
            fromStatus: existing.status,
            toStatus: next,
          };
        }
        assignedEmployeeId = null;
        assignedAt = null;
        assignedByUserId = null;
        handoverAcknowledgedAt = null;
      }
    }

    try {
      const updated = await ctx.run(async (tx) => {
        const asset = await tx.companyAsset.update({
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
            ...(body.depreciationMethod !== undefined
              ? { depreciationMethod: parseDepreciationMethod(body.depreciationMethod) }
              : {}),
            ...(body.usefulLifeMonths !== undefined
              ? { usefulLifeMonths: asOptionalInt(body.usefulLifeMonths) }
              : {}),
            ...(body.salvageValue !== undefined
              ? { salvageValue: asOptionalDecimal(body.salvageValue) }
              : {}),
            ...(body.nextMaintenanceAt !== undefined
              ? { nextMaintenanceAt: asDate(body.nextMaintenanceAt) }
              : {}),
            ...(existing.qrToken ? {} : { qrToken: generateAssetQrToken() }),
            assignedEmployeeId,
            assignedAt,
            assignedByUserId,
            handoverAcknowledgedAt,
            handoverNotes,
          },
          include: assetInclude,
        });

        if (lifecycleEvent) {
          await recordAssetAssignmentEvent(tx, {
            organizationId: ctx.organizationId,
            companyAssetId: asset.id,
            eventType: lifecycleEvent.eventType,
            employeeId: lifecycleEvent.employeeId,
            fromEmployeeId: lifecycleEvent.fromEmployeeId,
            performedByUserId: ctx.staff.id,
            fromStatus: lifecycleEvent.fromStatus,
            toStatus: lifecycleEvent.toStatus,
            notes: lifecycleEvent.notes,
          });
        }

        return asset;
      });

      await ctx.audit({
        action:
          action === 'assign'
            ? 'asset.assigned'
            : action === 'return'
              ? 'asset.returned'
              : action === 'acknowledge'
                ? 'asset.acknowledged'
                : 'asset.updated',
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
