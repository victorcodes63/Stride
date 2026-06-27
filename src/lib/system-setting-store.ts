import type { Prisma } from '@prisma/client';

/** Composite SystemSetting lookup (ISO-05). */
export type SystemSettingKey = {
  organizationId: string;
  key: string;
};

export function systemSettingId(organizationId: string, key: string): SystemSettingKey {
  return { organizationId, key };
}

export function systemSettingWhere(organizationId: string, key: string) {
  return { organizationId_key: { organizationId, key } };
}

export function systemSettingCreate(
  organizationId: string,
  key: string,
  value: Prisma.InputJsonValue,
  updatedByUserId?: string | null,
) {
  return {
    organizationId,
    key,
    value,
    updatedByUserId: updatedByUserId ?? null,
  };
}
