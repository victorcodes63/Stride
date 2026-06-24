import type { AssetCategory, AssetStatus } from '@prisma/client';
import { AssetCategory as AssetCategoryEnum, AssetStatus as AssetStatusEnum } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

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

export function parseAssetCategory(value: unknown): AssetCategory {
  const raw = asOptionalString(value);
  return raw && ASSET_CATEGORIES.has(raw) ? (raw as AssetCategory) : 'it_equipment';
}

export function parseAssetStatus(value: unknown): AssetStatus {
  const raw = asOptionalString(value);
  return raw && ASSET_STATUSES.has(raw) ? (raw as AssetStatus) : 'available';
}

type AssetRecord = {
  id: string;
  outsourcingClientId: string;
  assetTag: string;
  name: string;
  description: string | null;
  category: AssetCategory;
  status: AssetStatus;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  purchaseDate: Date | null;
  purchaseCost: Decimal | null;
  warrantyExpiry: Date | null;
  location: string | null;
  notes: string | null;
  assignedEmployeeId: string | null;
  assignedAt: Date | null;
  assignedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignedEmployee?: {
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
    jobTitle: string | null;
    department: { name: string } | null;
  } | null;
  assignedByUser?: { name: string } | null;
};

export function assetToResponse(record: AssetRecord) {
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
    purchaseCost: record.purchaseCost ? Number(record.purchaseCost) : null,
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
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
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
} as const;
