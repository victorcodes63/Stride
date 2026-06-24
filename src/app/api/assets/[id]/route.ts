import { NextRequest, NextResponse } from 'next/server';
import type { AssetStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessAssets,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { logAuditEvent } from '@/lib/audit-events';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
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

async function loadAsset(id: string, workspaceClientId: string) {
  return prisma.companyAsset.findFirst({
    where: { id, outsourcingClientId: workspaceClientId },
    include: assetInclude,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessAssets(user)) {
    return forbiddenResponse('Asset manager access is restricted to HR and operations.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { id } = await context.params;
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const record = await loadAsset(id, workspaceClientId);
  if (!record) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  return NextResponse.json(assetToResponse(record));
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessAssets(user)) {
    return forbiddenResponse('Asset manager access is restricted to HR and operations.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { id } = await context.params;
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const existing = await loadAsset(id, workspaceClientId);
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
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, outsourcingClientId: true },
    });
    if (!employee || employee.outsourcingClientId !== workspaceClientId) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    assignedEmployeeId = employeeId;
    assignedAt = new Date();
    assignedByUserId = user.id;
    status = 'assigned';
  } else if (action === 'return') {
    assignedEmployeeId = null;
    assignedAt = null;
    assignedByUserId = null;
    status = 'available';
  } else if ('assignedEmployeeId' in body) {
    const employeeId = asOptionalString(body.assignedEmployeeId);
    if (employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, outsourcingClientId: true },
      });
      if (!employee || employee.outsourcingClientId !== workspaceClientId) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      assignedEmployeeId = employeeId;
      assignedAt = new Date();
      assignedByUserId = user.id;
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
    const updated = await prisma.companyAsset.update({
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
    });

    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
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
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessAssets(user)) {
    return forbiddenResponse('Asset manager access is restricted to HR and operations.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { id } = await context.params;
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const existing = await loadAsset(id, workspaceClientId);
  if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  await prisma.companyAsset.delete({ where: { id } });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'asset.deleted',
    entityType: 'CompanyAsset',
    entityId: id,
    route: 'DELETE /api/assets/[id]',
    metadata: { assetTag: existing.assetTag },
  });

  return NextResponse.json({ success: true });
}
