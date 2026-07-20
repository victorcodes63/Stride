import type { AssetCategory, AssetStatus, Prisma } from '@prisma/client';
import { AssetCategory as AssetCategoryEnum, AssetStatus as AssetStatusEnum } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { computeDepreciation, parseDepreciationMethod } from '@/lib/asset-depreciation';

export const ASSET_CATEGORIES = new Set<string>(Object.values(AssetCategoryEnum));
export const ASSET_STATUSES = new Set<string>(Object.values(AssetStatusEnum));

export function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

export function asDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function asOptionalDecimal(value: unknown): Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Decimal(n);
}

export function asOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function parseAssetCategory(value: unknown): AssetCategory {
  const raw = asOptionalString(value);
  return raw && ASSET_CATEGORIES.has(raw) ? (raw as AssetCategory) : 'it_equipment';
}

export function parseAssetStatus(value: unknown): AssetStatus {
  const raw = asOptionalString(value);
  return raw && ASSET_STATUSES.has(raw) ? (raw as AssetStatus) : 'available';
}

/** Stable token encoded into printable asset labels / QR codes. */
export function generateAssetQrToken(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `AST-${Date.now().toString(36)}-${rand()}${rand()}`.toUpperCase();
}

export const ASSET_SORT_KEYS = new Set([
  'assetTag',
  'name',
  'category',
  'status',
  'location',
  'purchaseDate',
  'purchaseCost',
  'warrantyExpiry',
  'nextMaintenanceAt',
  'assignedAt',
  'createdAt',
  'updatedAt',
]);

export function buildAssetOrderBy(
  sortKey: string | null | undefined,
  sortDir: string | null | undefined,
): Prisma.CompanyAssetOrderByWithRelationInput[] {
  const dir: Prisma.SortOrder = sortDir === 'desc' ? 'desc' : 'asc';
  const key = sortKey && ASSET_SORT_KEYS.has(sortKey) ? sortKey : null;
  if (!key) {
    return [{ status: 'asc' }, { assetTag: 'asc' }];
  }
  return [{ [key]: dir } as Prisma.CompanyAssetOrderByWithRelationInput, { assetTag: 'asc' }];
}

export const assetInclude = {
  assignedEmployee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
      jobTitle: true,
      department: { select: { name: true } },
    },
  },
  assignedByUser: { select: { name: true } },
  _count: { select: { attachments: true, maintenanceRecords: true } },
} as const;

export type AssetRecordWithIncludes = Prisma.CompanyAssetGetPayload<{
  include: typeof assetInclude;
}>;

export function assetToResponse(record: AssetRecordWithIncludes) {
  const purchaseCost = record.purchaseCost != null ? Number(record.purchaseCost) : null;
  const salvageValue = record.salvageValue != null ? Number(record.salvageValue) : null;
  const depreciation = computeDepreciation({
    purchaseCost,
    salvageValue,
    usefulLifeMonths: record.usefulLifeMonths ?? null,
    purchaseDate: record.purchaseDate,
    method: record.depreciationMethod,
  });

  return {
    id: record.id,
    assetTag: record.assetTag,
    name: record.name,
    description: record.description,
    category: record.category,
    status: record.status,
    serialNumber: record.serialNumber,
    manufacturer: record.manufacturer,
    model: record.model,
    purchaseDate: record.purchaseDate?.toISOString().slice(0, 10) ?? null,
    purchaseCost,
    warrantyExpiry: record.warrantyExpiry?.toISOString().slice(0, 10) ?? null,
    location: record.location,
    notes: record.notes,
    assignedEmployeeId: record.assignedEmployeeId,
    assignedEmployeeName: record.assignedEmployee
      ? `${record.assignedEmployee.firstName} ${record.assignedEmployee.lastName}`.trim()
      : null,
    assignedEmployeeNumber: record.assignedEmployee?.employeeNumber ?? null,
    assignedEmployeeJobTitle: record.assignedEmployee?.jobTitle ?? null,
    assignedEmployeeDepartment: record.assignedEmployee?.department?.name ?? null,
    assignedAt: record.assignedAt?.toISOString() ?? null,
    assignedByUserName: record.assignedByUser?.name ?? null,
    handoverAcknowledgedAt: record.handoverAcknowledgedAt?.toISOString() ?? null,
    handoverNotes: record.handoverNotes,
    handoverSignaturePath: record.handoverSignaturePath,
    needsHandoverAck:
      record.status === 'assigned' &&
      record.assignedEmployeeId != null &&
      record.handoverAcknowledgedAt == null,
    // Depreciation
    depreciationMethod: parseDepreciationMethod(record.depreciationMethod),
    usefulLifeMonths: record.usefulLifeMonths ?? null,
    salvageValue,
    bookValue: depreciation?.bookValue ?? null,
    accumulatedDepreciation: depreciation?.accumulatedDepreciation ?? null,
    monthlyDepreciation: depreciation?.monthlyDepreciation ?? null,
    // Maintenance rollups
    lastMaintenanceAt: record.lastMaintenanceAt?.toISOString() ?? null,
    nextMaintenanceAt: record.nextMaintenanceAt?.toISOString().slice(0, 10) ?? null,
    maintenanceCount: record._count?.maintenanceRecords ?? 0,
    // Label / attachments
    qrToken: record.qrToken,
    attachmentCount: record._count?.attachments ?? 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export type AssetResponse = ReturnType<typeof assetToResponse>;
