import { NextRequest, NextResponse } from 'next/server';
import { assertReportsStaffRole, parseFormat, respondWithReport, ymd } from '@/app/api/reports/_shared';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatEnum(value: string | null): string {
  if (!value) return 'Unspecified';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const denied = assertReportsStaffRole(ctx.staff);
    if (denied) return denied;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const format = parseFormat(request);
    const now = new Date();
    const warrantyThreshold = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const maintenanceThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );

    const assets = await ctx.run((tx) =>
      tx.companyAsset.findMany({
        where: {
          outsourcingClientId: workspaceClientId,
          client: { organizationId: ctx.organizationId },
        },
        select: {
          assetTag: true,
          name: true,
          category: true,
          status: true,
          purchaseCost: true,
          warrantyExpiry: true,
          nextMaintenanceAt: true,
          location: true,
          assignedEmployee: { select: { firstName: true, lastName: true } },
        },
        orderBy: { assetTag: 'asc' },
      }),
    );

    const byCategoryMap = new Map<string, { category: string; count: number; cost: number }>();
    const byStatusMap = new Map<string, { status: string; count: number }>();
    let totalCost = 0;
    let assigned = 0;
    let warrantyExpiringSoon = 0;
    let maintenanceDue = 0;

    for (const asset of assets) {
      const cost = money(asset.purchaseCost);
      totalCost += cost;

      const category = formatEnum(asset.category);
      const c = byCategoryMap.get(category) ?? { category, count: 0, cost: 0 };
      c.count += 1;
      c.cost += cost;
      byCategoryMap.set(category, c);

      const status = formatEnum(asset.status);
      const s = byStatusMap.get(status) ?? { status, count: 0 };
      s.count += 1;
      byStatusMap.set(status, s);

      if (asset.assignedEmployee) assigned += 1;
      if (asset.warrantyExpiry && asset.warrantyExpiry <= warrantyThreshold) warrantyExpiringSoon += 1;
      if (asset.nextMaintenanceAt && asset.nextMaintenanceAt <= maintenanceThreshold) maintenanceDue += 1;
    }

    const byCategory = Array.from(byCategoryMap.values())
      .map((row) => ({ ...row, cost: round2(row.cost) }))
      .sort((a, b) => b.count - a.count);
    const byStatus = Array.from(byStatusMap.values()).sort((a, b) => b.count - a.count);

    const details = assets.map((asset) => ({
      assetTag: asset.assetTag,
      name: asset.name,
      category: formatEnum(asset.category),
      status: formatEnum(asset.status),
      assignedTo: asset.assignedEmployee
        ? `${asset.assignedEmployee.firstName} ${asset.assignedEmployee.lastName}`.trim()
        : '',
      location: asset.location ?? '',
      warrantyExpiry: asset.warrantyExpiry ? ymd(asset.warrantyExpiry) : '',
    }));

    const report = {
      totalAssets: assets.length,
      totalCost: round2(totalCost),
      assigned,
      unassigned: assets.length - assigned,
      warrantyExpiringSoon,
      maintenanceDue,
      byCategory,
      byStatus,
      details,
    };

    return respondWithReport({
      format,
      json: report,
      title: 'Asset Register Report',
      sheetName: 'Assets',
      baseFilename: `assets-${ymd(now)}`,
      headers: ['Category', 'Assets', 'Purchase cost'],
      rows: byCategory.map((row) => [row.category, row.count, row.cost]),
      summaryLines: [
        `Total assets: ${report.totalAssets}`,
        `Assigned: ${report.assigned} · Unassigned: ${report.unassigned}`,
        `Total purchase cost: ${report.totalCost}`,
        `Warranty expiring (90d): ${report.warrantyExpiringSoon}`,
        `Maintenance due (30d): ${report.maintenanceDue}`,
      ],
    });
  });
}
