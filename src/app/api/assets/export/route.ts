import { NextRequest, NextResponse } from 'next/server';
import type { AssetCategory, AssetStatus, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { canAccessAssets, forbiddenResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';
import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  assetInclude,
  assetToResponse,
  buildAssetOrderBy,
} from '@/lib/assets-api';
import { assetCategoryLabel, assetStatusLabel } from '@/lib/asset-categories';
import { depreciationMethodLabel } from '@/lib/asset-depreciation';

export const dynamic = 'force-dynamic';

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: 'Asset tag', key: 'assetTag', width: 16 },
  { header: 'Name', key: 'name', width: 28 },
  { header: 'Category', key: 'category', width: 18 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Serial number', key: 'serialNumber', width: 20 },
  { header: 'Manufacturer', key: 'manufacturer', width: 18 },
  { header: 'Model', key: 'model', width: 18 },
  { header: 'Location', key: 'location', width: 18 },
  { header: 'Assigned to', key: 'assignedEmployeeName', width: 24 },
  { header: 'Employee no.', key: 'assignedEmployeeNumber', width: 16 },
  { header: 'Handover acknowledged', key: 'handoverAcknowledged', width: 20 },
  { header: 'Purchase date', key: 'purchaseDate', width: 14 },
  { header: 'Purchase cost', key: 'purchaseCost', width: 16 },
  { header: 'Depreciation method', key: 'depreciationMethod', width: 20 },
  { header: 'Book value', key: 'bookValue', width: 16 },
  { header: 'Warranty expiry', key: 'warrantyExpiry', width: 16 },
  { header: 'Next maintenance', key: 'nextMaintenanceAt', width: 16 },
  { header: 'Created', key: 'createdAt', width: 14 },
];

function toRow(asset: ReturnType<typeof assetToResponse>): (string | number)[] {
  return [
    asset.assetTag,
    asset.name,
    assetCategoryLabel(asset.category),
    assetStatusLabel(asset.status),
    asset.serialNumber ?? '',
    asset.manufacturer ?? '',
    asset.model ?? '',
    asset.location ?? '',
    asset.assignedEmployeeName ?? '',
    asset.assignedEmployeeNumber ?? '',
    asset.handoverAcknowledgedAt ? 'Yes' : asset.needsHandoverAck ? 'Pending' : '',
    asset.purchaseDate ?? '',
    asset.purchaseCost ?? '',
    depreciationMethodLabel(asset.depreciationMethod),
    asset.bookValue ?? '',
    asset.warrantyExpiry ?? '',
    asset.nextMaintenanceAt ?? '',
    asset.createdAt.slice(0, 10),
  ];
}

function csvEscape(value: string | number): string {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
      return forbiddenResponse('Asset manager access is restricted to HR and operations.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );

    const params = request.nextUrl.searchParams;
    const format = params.get('format') === 'xlsx' ? 'xlsx' : 'csv';
    const categoryRaw = params.get('category');
    const statusRaw = params.get('status');
    const assignedOnly = params.get('assigned') === '1';
    const search = params.get('q')?.trim();
    const idsRaw = params.get('ids')?.trim();
    const ids = idsRaw ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean) : null;

    const category =
      categoryRaw && ASSET_CATEGORIES.has(categoryRaw) ? (categoryRaw as AssetCategory) : undefined;
    const status =
      statusRaw && ASSET_STATUSES.has(statusRaw) ? (statusRaw as AssetStatus) : undefined;

    const where: Prisma.CompanyAssetWhereInput = {
      outsourcingClientId: workspaceClientId,
      client: { organizationId: ctx.organizationId },
      ...(ids && ids.length ? { id: { in: ids } } : {}),
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(assignedOnly ? { assignedEmployeeId: { not: null } } : {}),
      ...(search
        ? {
            OR: [
              { assetTag: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { serialNumber: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const records = await ctx.run((tx) =>
      tx.companyAsset.findMany({
        where,
        include: assetInclude,
        orderBy: buildAssetOrderBy(params.get('sortKey'), params.get('sortDir')),
        take: 5000,
      }),
    );
    const assets = records.map(assetToResponse);

    await ctx.audit({
      action: 'asset.records.export',
      entityType: 'CompanyAsset',
      route: 'GET /api/assets/export',
      metadata: { format, count: assets.length, selected: ids?.length ?? null },
    });

    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const lines = [
        COLUMNS.map((c) => csvEscape(c.header)).join(','),
        ...assets.map((a) => toRow(a).map(csvEscape).join(',')),
      ];
      const body = `\uFEFF${lines.join('\r\n')}`;
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="assets-${dateStr}.csv"`,
        },
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Stride';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(`Assets ${dateStr}`, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.addRow(COLUMNS.map((c) => c.header));
    const header = sheet.getRow(1);
    header.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF043d4a' } };
    header.alignment = { wrapText: true, vertical: 'middle' };
    header.height = 22;

    for (const asset of assets) {
      sheet.addRow(toRow(asset));
    }

    sheet.columns = COLUMNS.map((c) => ({ width: c.width }));

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    for (let i = 1; i <= sheet.rowCount; i += 1) {
      sheet.getRow(i).eachCell((cell) => {
        cell.border = borderStyle;
        cell.alignment = { wrapText: true, vertical: 'top' };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="assets-${dateStr}.xlsx"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  });
}
