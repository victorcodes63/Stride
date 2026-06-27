import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import type { DeploymentEntitlements } from '@/lib/entitlements-types';
import { DEPLOYMENT_ENTITLEMENTS_KEY } from '@/lib/entitlements-types';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/org-membership';
import { systemSettingCreate, systemSettingWhere } from '@/lib/system-setting-store';

function parseEntitlementsValue(raw: Prisma.JsonValue): DeploymentEntitlements | null {
  try {
    if (typeof raw === 'string') {
      return JSON.parse(raw) as DeploymentEntitlements;
    }
    return raw as DeploymentEntitlements;
  } catch {
    return null;
  }
}

export async function loadDeploymentEntitlements(): Promise<DeploymentEntitlements | null> {
  const row = await prisma.systemSetting.findUnique({
    where: systemSettingWhere(DEFAULT_ORGANIZATION_ID, DEPLOYMENT_ENTITLEMENTS_KEY),
  });
  if (!row?.value) return null;
  return parseEntitlementsValue(row.value);
}

export async function saveDeploymentEntitlements(
  payload: DeploymentEntitlements,
): Promise<void> {
  const value = payload as unknown as Prisma.InputJsonValue;
  await prisma.systemSetting.upsert({
    where: systemSettingWhere(DEFAULT_ORGANIZATION_ID, DEPLOYMENT_ENTITLEMENTS_KEY),
    create: systemSettingCreate(DEFAULT_ORGANIZATION_ID, DEPLOYMENT_ENTITLEMENTS_KEY, value),
    update: { value },
  });
}
