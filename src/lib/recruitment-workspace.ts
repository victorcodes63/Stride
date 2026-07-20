import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { recruitmentEmployerNameFromEnv } from '@/lib/recruitment-employer-name';

export { recruitmentEmployerNameFromEnv };

export type RecruitmentSettingsDTO = {
  id: string;
  employerName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedClientId: string | null;
  updatedAt: string;
};

export function settingsToDto(row: {
  id: string;
  employerName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedClientId: string | null;
  updatedAt: Date;
}): RecruitmentSettingsDTO {
  return {
    id: row.id,
    employerName: row.employerName,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    linkedClientId: row.linkedClientId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Returns the recruitment org settings for `organizationId`, lazily creating a `Client` + settings
 * row for that tenant when none exists yet (e.g. a new organization before seed).
 *
 * Recruitment is per-tenant (RAV-62): each organization owns its own careers/hiring settings.
 * Look up and create are always scoped to the caller's active organization. A DB-level
 * "one row per org" constraint is a planned follow-up; until then getOrCreate guards duplicates.
 */
export async function getOrCreateRecruitmentSettings(
  db: PrismaClient | Prisma.TransactionClient,
  organizationId: string
): Promise<{
  id: string;
  employerName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedClientId: string | null;
  updatedAt: Date;
}> {
  const existing = await db.recruitmentSettings.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;

  const fromEnv = recruitmentEmployerNameFromEnv();
  const createdClient = await db.client.create({
    data: { organizationId, name: fromEnv, isAnonymous: false },
  });
  return db.recruitmentSettings.create({
    data: {
      // Unique per tenant (schema default 'default' would collide across orgs).
      id: randomUUID(),
      organizationId,
      employerName: fromEnv,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      linkedClientId: createdClient.id,
    },
  });
}

/** Resolve job `company` line and optional `clientId` (linked org client) for persistence. */
export async function resolveJobCompanyAndClientId(
  db: PrismaClient | Prisma.TransactionClient,
  companyInput: string | undefined,
  organizationId: string
): Promise<{ company: string; clientId: string | null }> {
  const settings = await getOrCreateRecruitmentSettings(db, organizationId);
  const raw = (companyInput ?? '').trim();
  if (!raw) {
    return { company: settings.employerName, clientId: settings.linkedClientId };
  }
  return { company: raw, clientId: settings.linkedClientId };
}
