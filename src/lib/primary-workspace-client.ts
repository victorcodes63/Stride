import type { PrismaClient } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { getWorkspaceDefaults } from '@/lib/deployment-config';
import { resolveEntityIdOrDefault } from '@/lib/entity-request';
import { getActiveEntities, loadOperatingEntitiesSettings } from '@/lib/operating-entities';

/**
 * Single-tenant helper: resolve the primary outsourcing workspace client.
 * If none exists yet, create one from deployment env (PROVISION_ORG_NAME, etc.).
 */
export async function getOrCreatePrimaryWorkspaceClient(prisma: PrismaClient) {
  const settings = await loadOperatingEntitiesSettings();
  const defaultEntity = settings.defaultEntityId;
  const existing = await prisma.outsourcingClient.findFirst({
    where: { entityCode: defaultEntity },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;

  const anyClient = await prisma.outsourcingClient.findFirst({ orderBy: { createdAt: 'asc' } });
  if (anyClient) return anyClient;

  const defaults = getWorkspaceDefaults();
  return prisma.outsourcingClient.create({
    data: {
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
  prisma: PrismaClient,
  requestedClientId?: string | null,
  request?: Pick<NextRequest, 'headers' | 'cookies' | 'nextUrl'> | NextRequest | null,
) {
  const requested = requestedClientId?.trim();
  if (request) {
    const entityId = await resolveEntityIdOrDefault(request);
    if (entityId) {
      if (requested) {
        const scoped = await prisma.outsourcingClient.findFirst({
          where: { id: requested, entityCode: entityId },
          select: { id: true },
        });
        if (!scoped) {
          throw new Error(`Requested client is outside active entity scope (${entityId}).`);
        }
        return scoped.id;
      }
      const row = await prisma.outsourcingClient.findFirst({
        where: { entityCode: entityId },
        select: { id: true },
      });
      if (row) return row.id;
    }
  }
  if (requested) return requested;
  const workspace = await getOrCreatePrimaryWorkspaceClient(prisma);
  return workspace.id;
}

/**
 * Outsourcing clients tied to configured operating entities.
 * Used for combined list views that span multiple legal employers.
 */
export async function listEntitySwitcherOutsourcingClientIds(prisma: PrismaClient): Promise<string[]> {
  const settings = await loadOperatingEntitiesSettings();
  const entityCodes = getActiveEntities(settings).map((e) => e.id);
  const rows = await prisma.outsourcingClient.findMany({
    where: { entityCode: { in: entityCodes } },
    select: { id: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => r.id);
}
