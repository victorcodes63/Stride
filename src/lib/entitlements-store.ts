import { prisma } from '@/lib/prisma';
import type { DeploymentEntitlements } from '@/lib/entitlements-types';
import { DEPLOYMENT_ENTITLEMENTS_KEY } from '@/lib/entitlements-types';

export async function loadDeploymentEntitlements(): Promise<DeploymentEntitlements | null> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: DEPLOYMENT_ENTITLEMENTS_KEY },
  });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as DeploymentEntitlements;
  } catch {
    return null;
  }
}

export async function saveDeploymentEntitlements(
  payload: DeploymentEntitlements,
): Promise<void> {
  const value = JSON.stringify(payload);
  await prisma.systemSetting.upsert({
    where: { key: DEPLOYMENT_ENTITLEMENTS_KEY },
    create: { key: DEPLOYMENT_ENTITLEMENTS_KEY, value },
    update: { value },
  });
}
