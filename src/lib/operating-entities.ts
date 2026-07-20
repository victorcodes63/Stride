import 'server-only';

import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withOrgContext } from '@/lib/org-context';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/org-membership';
import { systemSettingCreate, systemSettingWhere } from '@/lib/system-setting-store';
import { loadCompanySetupSettings } from '@/lib/company-setup';

export {
  OPERATING_ENTITIES_SETTINGS_KEY,
  buildDefaultOperatingEntitiesSettings,
  buildVerticalShowcaseOperatingEntitiesSettings,
  COUNTRY_PROFILES,
  countryCodeToSlug,
  defaultEntitySlugFromEnv,
  filterEntitiesForEntitySwitcher,
  getActiveEntities,
  getDefaultCurrency,
  isMultiEntityEnvEnabled,
  isVerticalShowcaseKenyaSlug,
  parseVerticalShowcasePackFromEntitySlug,
  resolveEntitySlugOrDefault,
  sanitizeOperatingEntitiesSettings,
  shouldShowEntitySwitcher,
  slugToCountryCode,
  toPublicEntities,
  toPublicEntity,
  validateEntitySlug,
  validateOperatingEntitiesPatch,
  type CountryCode,
  type OperatingEntitiesSettings,
  type OperatingEntitiesValidationError,
  type OperatingEntity,
  type OutsourcingClientEntityRow,
  type PublicEntity,
} from '@/lib/operating-entities-shared';

import {
  buildDefaultOperatingEntitiesSettings,
  COUNTRY_PROFILES,
  OPERATING_ENTITIES_SETTINGS_KEY,
  sanitizeOperatingEntitiesSettings,
  type OperatingEntitiesSettings,
} from '@/lib/operating-entities-shared';

export async function loadOperatingEntitiesSettings(): Promise<OperatingEntitiesSettings> {
  if (!process.env.DATABASE_URL) {
    const setup = await loadCompanySetupSettings();
    return buildDefaultOperatingEntitiesSettings(setup.orgName || undefined);
  }
  try {
    const row = await withOrgContext(DEFAULT_ORGANIZATION_ID, (tx) =>
      tx.systemSetting.findUnique({
        where: systemSettingWhere(DEFAULT_ORGANIZATION_ID, OPERATING_ENTITIES_SETTINGS_KEY),
      }),
    );
    if (!row) {
      const setup = await loadCompanySetupSettings();
      return buildDefaultOperatingEntitiesSettings(setup.orgName || undefined);
    }
    return sanitizeOperatingEntitiesSettings(row.value);
  } catch {
    return buildDefaultOperatingEntitiesSettings();
  }
}

/** Tenant-scoped operating entities — avoids leaking demo SwiftFreight config into new orgs. */
export async function loadOperatingEntitiesSettingsForOrg(
  organizationId: string,
): Promise<OperatingEntitiesSettings> {
  if (!process.env.DATABASE_URL) {
    return buildDefaultOperatingEntitiesSettings();
  }
  try {
    return await withOrgContext(organizationId, async (tx) => {
      const row = await tx.systemSetting.findUnique({
        where: systemSettingWhere(organizationId, OPERATING_ENTITIES_SETTINGS_KEY),
      });
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, country: true, currency: true },
      });
      if (row) return sanitizeOperatingEntitiesSettings(row.value);
      return buildDefaultOperatingEntitiesSettings(org?.name);
    });
  } catch {
    return buildDefaultOperatingEntitiesSettings();
  }
}

/** Upsert OutsourcingClient rows to mirror configured operating entities. */
export async function syncOperatingEntitiesToOutsourcingClients(
  db: PrismaClient,
  settings: OperatingEntitiesSettings,
  organizationId: string,
): Promise<void> {
  for (const entity of settings.entities) {
    const entityCode = entity.id;
    const profile = COUNTRY_PROFILES[entity.countryCode];
    const existing = await db.outsourcingClient.findFirst({ where: { entityCode, organizationId } });

    const data = {
      name: entity.legalName,
      currency: entity.currency,
      employeeNumberPrefix: entity.employeeNumberPrefix,
      entityCode,
      county: profile.country,
      kraPin: entity.kraPin ?? null,
      nssfEmployerNumber: entity.nssfEmployerNumber ?? null,
      nhifEmployerNumber: entity.nhifEmployerNumber ?? null,
      companyRegistrationNumber: entity.companyRegistrationNumber ?? null,
      vatNumber: entity.vatNumber ?? null,
    };

    if (existing) {
      await db.outsourcingClient.update({ where: { id: existing.id }, data });
    } else if (entity.isActive) {
      await db.outsourcingClient.create({ data: { ...data, organizationId } });
    }
  }
}
