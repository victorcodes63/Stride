import { NextRequest, NextResponse } from 'next/server';
import type { AssetCategory, AssetStatus, Prisma } from '@prisma/client';
import {
  canAccessAssets,
  forbiddenResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  asDate,
  asOptionalDecimal,
  asOptionalInt,
  asOptionalString,
  assetInclude,
  assetToResponse,
  buildAssetOrderBy,
  generateAssetQrToken,
  parseAssetCategory,
  parseAssetStatus,
} from '@/lib/assets-api';
import { parseDepreciationMethod } from '@/lib/asset-depreciation';
import { recordAssetAssignmentEvent } from '@/lib/asset-lifecycle';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
      return forbiddenResponse('Asset manager access is restricted to HR and operations.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ items: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE });
    }

    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );

    const params = request.nextUrl.searchParams;
    const categoryRaw = params.get('category');
    const statusRaw = params.get('status');
    const assignedOnly = params.get('assigned') === '1';
    const handoverPending = params.get('handover') === 'pending';
    const employeeId = params.get('employeeId') || undefined;
    const search = params.get('q')?.trim();

    const category =
      categoryRaw && ASSET_CATEGORIES.has(categoryRaw) ? (categoryRaw as AssetCategory) : undefined;
    const status =
      statusRaw && ASSET_STATUSES.has(statusRaw) ? (statusRaw as AssetStatus) : undefined;

    const pageRaw = Number.parseInt(params.get('page') ?? '1', 10);
    const pageSizeRaw = Number.parseInt(params.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const pageSize = Number.isFinite(pageSizeRaw)
      ? Math.min(Math.max(pageSizeRaw, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    const orderBy = buildAssetOrderBy(params.get('sortKey'), params.get('sortDir'));

    const searchFilter: Prisma.CompanyAssetWhereInput | undefined = search
      ? {
          OR: [
            { assetTag: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { serialNumber: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
            { manufacturer: { contains: search, mode: 'insensitive' } },
            { model: { contains: search, mode: 'insensitive' } },
            {
              assignedEmployee: {
                is: {
                  OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { employeeNumber: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }
      : undefined;

    const where: Prisma.CompanyAssetWhereInput = {
      outsourcingClientId: workspaceClientId,
      client: { organizationId: ctx.organizationId },
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(assignedOnly ? { assignedEmployeeId: { not: null } } : {}),
      ...(handoverPending
        ? { status: 'assigned', assignedEmployeeId: { not: null }, handoverAcknowledgedAt: null }
        : {}),
      ...(employeeId ? { assignedEmployeeId: employeeId } : {}),
      ...(searchFilter ?? {}),
    };

    const { total, records } = await ctx.run(async (tx) => {
      const count = await tx.companyAsset.count({ where });
      const rows = await tx.companyAsset.findMany({
        where,
        include: assetInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      return { total: count, records: rows };
    });

    await ctx.audit({
      action: 'asset.records.view',
      entityType: 'CompanyAsset',
      route: 'GET /api/assets',
      metadata: { count: records.length, total, page, pageSize },
    });

    return NextResponse.json({
      items: records.map(assetToResponse),
      total,
      page,
      pageSize,
    });
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
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

    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );
    const category = parseAssetCategory(body.category);
    let status = parseAssetStatus(body.status);
    const assignEmployeeId = asOptionalString(body.assignedEmployeeId);

    if (assignEmployeeId) {
      const employee = await ctx.run((tx) =>
        tx.employee.findFirst({
          where: {
            id: assignEmployeeId,
            outsourcingClientId: workspaceClientId,
            client: { organizationId: ctx.organizationId },
          },
          select: { id: true, outsourcingClientId: true },
        }),
      );
      if (!employee || employee.outsourcingClientId !== workspaceClientId) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      status = 'assigned';
    }

    try {
      const created = await ctx.run(async (tx) => {
        const asset = await tx.companyAsset.create({
          data: {
            organizationId: ctx.organizationId,
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
            depreciationMethod:
              body.depreciationMethod !== undefined
                ? parseDepreciationMethod(body.depreciationMethod)
                : undefined,
            usefulLifeMonths: asOptionalInt(body.usefulLifeMonths) ?? undefined,
            salvageValue: asOptionalDecimal(body.salvageValue) ?? undefined,
            handoverNotes: asOptionalString(body.handoverNotes) ?? undefined,
            nextMaintenanceAt: asDate(body.nextMaintenanceAt) ?? undefined,
            qrToken: generateAssetQrToken(),
            assignedEmployeeId: assignEmployeeId ?? undefined,
            assignedAt: assignEmployeeId ? new Date() : undefined,
            assignedByUserId: assignEmployeeId ? ctx.staff.id : undefined,
          },
          include: assetInclude,
        });

        await recordAssetAssignmentEvent(tx, {
          organizationId: ctx.organizationId,
          companyAssetId: asset.id,
          eventType: 'created',
          toStatus: status,
          performedByUserId: ctx.staff.id,
        });

        if (assignEmployeeId) {
          await recordAssetAssignmentEvent(tx, {
            organizationId: ctx.organizationId,
            companyAssetId: asset.id,
            eventType: 'assigned',
            employeeId: assignEmployeeId,
            toStatus: 'assigned',
            performedByUserId: ctx.staff.id,
          });
        }

        return asset;
      });

      await ctx.audit({
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
  });
}
