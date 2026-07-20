import type {
  AssetMaintenance,
  AssetMaintenanceStatus,
  AssetMaintenanceType,
  Prisma,
} from '@prisma/client';
import {
  AssetMaintenanceStatus as MaintenanceStatusEnum,
  AssetMaintenanceType as MaintenanceTypeEnum,
} from '@prisma/client';

export const MAINTENANCE_TYPES = new Set<string>(Object.values(MaintenanceTypeEnum));
export const MAINTENANCE_STATUSES = new Set<string>(Object.values(MaintenanceStatusEnum));

export const ASSET_MAINTENANCE_TYPES: { value: AssetMaintenanceType; label: string }[] = [
  { value: 'preventive', label: 'Preventive' },
  { value: 'corrective', label: 'Corrective' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'repair', label: 'Repair' },
  { value: 'other', label: 'Other' },
];

export const ASSET_MAINTENANCE_STATUSES: { value: AssetMaintenanceStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function maintenanceTypeLabel(value: string): string {
  return ASSET_MAINTENANCE_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function maintenanceStatusLabel(value: string): string {
  return ASSET_MAINTENANCE_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function parseMaintenanceType(value: unknown): AssetMaintenanceType {
  return typeof value === 'string' && MAINTENANCE_TYPES.has(value)
    ? (value as AssetMaintenanceType)
    : 'preventive';
}

export function parseMaintenanceStatus(value: unknown): AssetMaintenanceStatus | null {
  return typeof value === 'string' && MAINTENANCE_STATUSES.has(value)
    ? (value as AssetMaintenanceStatus)
    : null;
}

export function maintenanceToResponse(
  record: AssetMaintenance,
  userNames?: Map<string, string>,
) {
  return {
    id: record.id,
    companyAssetId: record.companyAssetId,
    type: record.type,
    status: record.status,
    title: record.title,
    description: record.description,
    vendor: record.vendor,
    cost: record.cost != null ? Number(record.cost) : null,
    scheduledFor: record.scheduledFor?.toISOString().slice(0, 10) ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    nextDueAt: record.nextDueAt?.toISOString().slice(0, 10) ?? null,
    performedByUserId: record.performedByUserId,
    performedByUserName:
      (record.performedByUserId && userNames?.get(record.performedByUserId)) ?? null,
    createdByUserId: record.createdByUserId,
    createdByUserName:
      (record.createdByUserId && userNames?.get(record.createdByUserId)) ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export type AssetMaintenanceResponse = ReturnType<typeof maintenanceToResponse>;

/** Resolve a userId -> display name map for a set of maintenance records. */
export async function resolveMaintenanceUserNames(
  tx: Prisma.TransactionClient,
  records: AssetMaintenance[],
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(
      records.flatMap((r) =>
        [r.performedByUserId, r.createdByUserId].filter((id): id is string => Boolean(id)),
      ),
    ),
  );
  if (ids.length === 0) return new Map();
  const users = await tx.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}
