import type { Prisma, PrismaClient } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getWorkspaceDefaults } from '@/lib/deployment-config';
import { resolveEntityIdOrDefault } from '@/lib/entity-request';
import { getActiveEntities, loadOperatingEntitiesSettingsForOrg } from '@/lib/operating-entities';

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Single-tenant helper: resolve the primary outsourcing workspace client.
 * If none exists yet, create one from deployment env (PROVISION_ORG_NAME, etc.).
 */
export async function getOrCreatePrimaryWorkspaceClient(
  db: DbClient,
  organizationId: string,
) {
  const settings = await loadOperatingEntitiesSettingsForOrg(organizationId);
  const defaultEntity = settings.defaultEntityId;
  const existing = await db.outsourcingClient.findFirst({
    where: { organizationId, entityCode: defaultEntity },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;

  const anyClient = await db.outsourcingClient.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
  });
  if (anyClient) return anyClient;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  const defaults = getWorkspaceDefaults(org?.name);
  return db.outsourcingClient.create({
    data: {
      organizationId,
      name: defaults.name,
      employeeNumberPrefix: defaults.employeeNumberPrefix,
      currency: defaults.currency,
      contactName: defaults.contactName,
      contactEmail: defaults.contactEmail,
      contactPhone: defaults.contactPhone,
      entityCode: defaults.entityCode,
    },
  });
}

export async function resolvePrimaryWorkspaceClientId(
  db: DbClient,
  requestedClientId?: string | null,
  request?: Pick<NextRequest, 'headers' | 'cookies' | 'nextUrl'> | NextRequest | null,
  organizationId?: string,
) {
  const requested = requestedClientId?.trim();
  let orgId = organizationId;
  if (!orgId && request) {
    const staff = await requireStaffUser(request as NextRequest);
    orgId = staff?.currentOrgId;
  }
  if (!orgId) {
    throw new Error('organizationId is required to resolve the primary workspace client.');
  }
  if (request) {
    const entityId = await resolveEntityIdOrDefault(request);
    if (entityId) {
      if (requested) {
        const scoped = await db.outsourcingClient.findFirst({
          where: { id: requested, organizationId: orgId, entityCode: entityId },
          select: { id: true },
        });
        if (!scoped) {
          throw new Error(`Requested client is outside active entity scope (${entityId}).`);
        }
        return scoped.id;
      }
      const row = await db.outsourcingClient.findFirst({
        where: { organizationId: orgId, entityCode: entityId },
        select: { id: true },
      });
      if (row) return row.id;
    }
  }
  if (requested) return requested;
  const workspace = await getOrCreatePrimaryWorkspaceClient(db, orgId);
  return workspace.id;
}

/**
 * Outsourcing clients tied to configured operating entities.
 * Used for combined list views that span multiple legal employers.
 */
export async function listEntitySwitcherOutsourcingClientIds(db: DbClient): Promise<string[]> {
  const settings = await loadOperatingEntitiesSettings();
  const entityCodes = getActiveEntities(settings).map((e) => e.id);
  const rows = await db.outsourcingClient.findMany({
    where: { entityCode: { in: entityCodes } },
    select: { id: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => r.id);
}
