import { prisma } from "@/lib/prisma";
import type { DeploymentEntitlements } from "@/lib/entitlements-types";

const ENTITLEMENTS_KEY = "entitlements";

export async function loadOrganizationEntitlements(
  organizationId: string,
): Promise<DeploymentEntitlements | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  if (!org?.settings || typeof org.settings !== "object") return null;
  const settings = org.settings as Record<string, unknown>;
  const ent = settings[ENTITLEMENTS_KEY];
  if (!ent || typeof ent !== "object") return null;
  return ent as DeploymentEntitlements;
}

export async function saveOrganizationEntitlements(
  organizationId: string,
  payload: DeploymentEntitlements,
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const prev =
    org?.settings && typeof org.settings === "object"
      ? (org.settings as Record<string, unknown>)
      : {};
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...prev,
        [ENTITLEMENTS_KEY]: payload,
      },
    },
  });
}
