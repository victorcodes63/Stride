import type { Prisma, PrismaClient } from '@prisma/client';
import { brand } from '@/lib/brand';

const DEFAULT_ID = 'default' as const;

/** Public employer name when DB is not configured (align with job form default). */
export function recruitmentEmployerNameFromEnv(): string {
  return (
    process.env.NEXT_PUBLIC_RECRUITMENT_EMPLOYER_NAME?.trim() ||
    process.env.RECRUITMENT_EMPLOYER_NAME?.trim() ||
    brand.orgName
  );
}

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
 * Returns recruitment org settings, creating a default `Client` + row when the DB is empty
 * (e.g. new environment before seed).
 */
export async function getOrCreateRecruitmentSettings(
  db: PrismaClient | Prisma.TransactionClient
): Promise<{
  id: string;
  employerName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedClientId: string | null;
  updatedAt: Date;
}> {
  const existing = await db.recruitmentSettings.findUnique({ where: { id: DEFAULT_ID } });
  if (existing) return existing;

  const fromEnv = recruitmentEmployerNameFromEnv();
  const createdClient = await db.client.create({
    data: { name: fromEnv, isAnonymous: false },
  });
  return db.recruitmentSettings.create({
    data: {
      id: DEFAULT_ID,
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
  companyInput: string | undefined
): Promise<{ company: string; clientId: string | null }> {
  const settings = await getOrCreateRecruitmentSettings(db);
  const raw = (companyInput ?? '').trim();
  if (!raw) {
    return { company: settings.employerName, clientId: settings.linkedClientId };
  }
  return { company: raw, clientId: settings.linkedClientId };
}
