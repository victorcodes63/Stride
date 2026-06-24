import { NextRequest, NextResponse } from 'next/server';
import type { AssetCategory, AssetStatus } from '@prisma/client';
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
  ASSET_CATEGORIES,
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

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessAssets(user)) {
    return forbiddenResponse('Asset manager access is restricted to HR and operations.');
  }
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const categoryRaw = request.nextUrl.searchParams.get('category');
  const statusRaw = request.nextUrl.searchParams.get('status');
  const assignedOnly = request.nextUrl.searchParams.get('assigned') === '1';
  const employeeId = request.nextUrl.searchParams.get('employeeId') || undefined;
  const search = request.nextUrl.searchParams.get('q')?.trim().toLowerCase();

  const category =
    categoryRaw && ASSET_CATEGORIES.has(categoryRaw) ? (categoryRaw as AssetCategory) : undefined;
  const status =
    statusRaw && ASSET_STATUSES.has(statusRaw) ? (statusRaw as AssetStatus) : undefined;

  const records = await prisma.companyAsset.findMany({
    where: {
      outsourcingClientId: workspaceClientId,
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(assignedOnly ? { assignedEmployeeId: { not: null } } : {}),
      ...(employeeId ? { assignedEmployeeId: employeeId } : {}),
    },
    include: assetInclude,
    orderBy: [{ status: 'asc' }, { assetTag: 'asc' }],
  });

  const mapped = records.map(assetToResponse);
  const filtered = search
    ? mapped.filter((item) => {
        const haystack = [
          item.assetTag,
          item.name,
          item.serialNumber ?? '',
          item.assignedEmployeeName ?? '',
          item.location ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      })
    : mapped;

  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'asset.records.view',
    entityType: 'CompanyAsset',
    route: 'GET /api/assets',
    metadata: { count: filtered.length },
  });

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessAssets(user)) {
    return forbiddenResponse('Asset manager access is restricted to HR and operations.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const assetTag = asOptionalString(body.assetTag);
  const name = asOptionalString(body.name);
  if (!assetTag) return NextResponse.json({ error: 'assetTag is required' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const category = parseAssetCategory(body.category);
  let status = parseAssetStatus(body.status);
  const assignEmployeeId = asOptionalString(body.assignedEmployeeId);

  if (assignEmployeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: assignEmployeeId },
      select: { id: true, outsourcingClientId: true },
    });
    if (!employee || employee.outsourcingClientId !== workspaceClientId) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    status = 'assigned';
  }

  try {
    const created = await prisma.companyAsset.create({
      data: {
        outsourcingClientId: workspaceClientId,
        assetTag,
        name,
        description: asOptionalString(body.description) ?? undefined,
        category,
        status,
        serialNumber: asOptionalString(body.serialNumber) ?? undefined,
        manufacturer: asOptionalString(body.manufacturer) ?? undefined,
        model: asOptionalString(body.model) ?? undefined,
        purchaseDate: asDate(body.purchaseDate) ?? undefined,
        purchaseCost: asOptionalDecimal(body.purchaseCost) ?? undefined,
        warrantyExpiry: asDate(body.warrantyExpiry) ?? undefined,
        location: asOptionalString(body.location) ?? undefined,
        notes: asOptionalString(body.notes) ?? undefined,
        assignedEmployeeId: assignEmployeeId ?? undefined,
        assignedAt: assignEmployeeId ? new Date() : undefined,
        assignedByUserId: assignEmployeeId ? user.id : undefined,
      },
      include: assetInclude,
    });

    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'asset.created',
      entityType: 'CompanyAsset',
      entityId: created.id,
      route: 'POST /api/assets',
      metadata: { assetTag: created.assetTag, category: created.category },
    });

    return NextResponse.json(assetToResponse(created), { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Asset tag already exists' }, { status: 409 });
    }
    throw error;
  }
}
