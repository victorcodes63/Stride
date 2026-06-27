import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withOrgContext } from '@/lib/org-context';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/org-membership';
import { systemSettingCreate, systemSettingWhere } from '@/lib/system-setting-store';
import { getDefaultCountry, getDefaultCurrency, getWorkspaceDefaults, isMultiEntityEnvEnabled } from '@/lib/deployment-config';
import { loadCompanySetupSettings } from '@/lib/company-setup';
import { isMultiContextDemoEnabled } from '@/lib/demo-entity-slug';
import {
  DEMO_VERTICAL_CATALOG,
  parseVerticalFromEntitySlug,
  type VerticalShowcasePackId,
} from '@/lib/demo-vertical-catalog';
import { STRIDE_BRAND_PRIMARY } from '@/lib/stride-palette';

export const OPERATING_ENTITIES_SETTINGS_KEY = 'admin.operating.entities';

const VERTICAL_SHOWCASE_PACK_ORDER = Object.keys(DEMO_VERTICAL_CATALOG) as VerticalShowcasePackId[];

const SHOWCASE_COMPOSITE_SLUG = /^([a-z][a-z0-9-]*)__(ke|ug)$/;

export function parseVerticalShowcasePackFromEntitySlug(entityId: string): VerticalShowcasePackId | null {
  const match = entityId.trim().toLowerCase().match(SHOWCASE_COMPOSITE_SLUG);
  if (!match) return null;
  const packId = match[1] as VerticalShowcasePackId;
  return packId in DEMO_VERTICAL_CATALOG ? packId : null;
}

export function isVerticalShowcaseKenyaSlug(entityId: string): boolean {
  return entityId.endsWith('__ke') && parseVerticalShowcasePackFromEntitySlug(entityId) !== null;
}

/** Multi-vertical sales demo: one Kenya entity per sector in the switcher (not KE+UG pairs). */
export function filterEntitiesForEntitySwitcher(entities: OperatingEntity[]): OperatingEntity[] {
  if (!isMultiContextDemoEnabled()) return entities;
  const keShowcase = entities.filter((e) => e.isActive && isVerticalShowcaseKenyaSlug(e.id));
  if (keShowcase.length < 2) return entities;
  return [...keShowcase].sort((a, b) => {
    const pa = parseVerticalShowcasePackFromEntitySlug(a.id)!;
    const pb = parseVerticalShowcasePackFromEntitySlug(b.id)!;
    return VERTICAL_SHOWCASE_PACK_ORDER.indexOf(pa) - VERTICAL_SHOWCASE_PACK_ORDER.indexOf(pb);
  });
}

export type OutsourcingClientEntityRow = {
  entityCode: string | null;
  name: string;
  currency: string | null;
  employeeNumberPrefix: string | null;
};

/** Build switcher config — one active Kenya entity per vertical showcase pack. */
export function buildVerticalShowcaseOperatingEntitiesSettings(
  clients: OutsourcingClientEntityRow[],
): OperatingEntitiesSettings {
  const showcase = clients
    .filter((c) => c.entityCode && isVerticalShowcaseKenyaSlug(c.entityCode.toLowerCase()))
    .sort((a, b) => {
      const pa = parseVerticalShowcasePackFromEntitySlug(a.entityCode!.toLowerCase())!;
      const pb = parseVerticalShowcasePackFromEntitySlug(b.entityCode!.toLowerCase())!;
      return VERTICAL_SHOWCASE_PACK_ORDER.indexOf(pa) - VERTICAL_SHOWCASE_PACK_ORDER.indexOf(pb);
    });

  const entities: OperatingEntity[] = showcase.map((client) => ({
    id: client.entityCode!.toLowerCase(),
    legalName: client.name,
    countryCode: 'KE',
    currency: client.currency ?? 'KES',
    employeeNumberPrefix: client.employeeNumberPrefix ?? 'EMP',
    isActive: true,
  }));

  return sanitizeOperatingEntitiesSettings({
    multiEntityEnabled: true,
    defaultEntityId: entities[0]?.id ?? 'generic__ke',
    entities,
  });
}

export type CountryCode = 'KE' | 'UG';

export type OperatingEntity = {
  id: string;
  legalName: string;
  countryCode: CountryCode;
  currency: string;
  employeeNumberPrefix: string;
  isActive: boolean;
  kraPin?: string;
  nssfEmployerNumber?: string;
  nhifEmployerNumber?: string;
  companyRegistrationNumber?: string;
  vatNumber?: string;
};

export type OperatingEntitiesSettings = {
  /** Admin toggle that enables the dashboard entity switcher when multiple entities are active. */
  multiEntityEnabled: boolean;
  entities: OperatingEntity[];
  defaultEntityId: string;
};

export type PublicEntity = {
  id: string;
  name: string;
  country: string;
  countryCode: CountryCode;
  currency: string;
  flag: string;
  color: string;
  /** Industry sector label for multi-vertical demo switcher */
  sector?: string;
};

export const COUNTRY_PROFILES: Record<
  CountryCode,
  { country: string; flag: string; color: string; defaultCurrency: string }
> = {
  KE: { country: 'Kenya', flag: '🇰🇪', color: STRIDE_BRAND_PRIMARY, defaultCurrency: 'KES' },
  UG: { country: 'Uganda', flag: '🇺🇬', color: '#000000', defaultCurrency: 'UGX' },
};

const SLUG_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/;

export function countryCodeToSlug(code: CountryCode): string {
  return code.toLowerCase();
}

export function slugToCountryCode(slug: string): CountryCode {
  return slug.toLowerCase() === 'ug' ? 'UG' : 'KE';
}

export function defaultEntitySlugFromEnv(): string {
  return countryCodeToSlug(getDefaultCountry());
}

function str(raw: Record<string, unknown>, key: string, fallback = ''): string {
  const v = raw[key];
  return typeof v === 'string' ? v.trim() : fallback;
}

function bool(raw: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = raw[key];
  return v === undefined ? fallback : Boolean(v);
}

function sanitizeCountryCode(value: unknown): CountryCode {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return v === 'UG' ? 'UG' : 'KE';
}

function sanitizeEntity(raw: unknown, index: number): OperatingEntity | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const countryCode = sanitizeCountryCode(r.countryCode);
  const id = str(r, 'id').toLowerCase() || countryCodeToSlug(countryCode);
  if (!SLUG_PATTERN.test(id)) return null;

  const profile = COUNTRY_PROFILES[countryCode];
  return {
    id,
    legalName: str(r, 'legalName') || profile.country,
    countryCode,
    currency: str(r, 'currency') || profile.defaultCurrency,
    employeeNumberPrefix: str(r, 'employeeNumberPrefix') || 'EMP',
    isActive: r.isActive === undefined ? true : Boolean(r.isActive),
    kraPin: str(r, 'kraPin') || undefined,
    nssfEmployerNumber: str(r, 'nssfEmployerNumber') || undefined,
    nhifEmployerNumber: str(r, 'nhifEmployerNumber') || undefined,
    companyRegistrationNumber: str(r, 'companyRegistrationNumber') || undefined,
    vatNumber: str(r, 'vatNumber') || undefined,
  };
}

export function buildDefaultOperatingEntitiesSettings(orgName?: string): OperatingEntitiesSettings {
  const defaults = getWorkspaceDefaults();
  const country = getDefaultCountry();
  const slug = defaults.entityCode;
  const profile = COUNTRY_PROFILES[country];
  const name = orgName?.trim() || defaults.name;

  return {
    multiEntityEnabled: false,
    defaultEntityId: slug,
    entities: [
      {
        id: slug,
        legalName: name,
        countryCode: country,
        currency: defaults.currency || profile.defaultCurrency,
        employeeNumberPrefix: defaults.employeeNumberPrefix,
        isActive: true,
      },
    ],
  };
}

export function sanitizeOperatingEntitiesSettings(value: unknown): OperatingEntitiesSettings {
  const raw = (value ?? {}) as Record<string, unknown>;
  const parsedEntities = Array.isArray(raw.entities)
    ? raw.entities.map(sanitizeEntity).filter((e): e is OperatingEntity => e !== null)
    : [];

  let entities = parsedEntities.length > 0 ? parsedEntities : buildDefaultOperatingEntitiesSettings().entities;

  // De-dupe by slug
  const seen = new Set<string>();
  entities = entities.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  const activeEntities = entities.filter((e) => e.isActive);
  const fallbackDefault = activeEntities[0]?.id ?? entities[0]?.id ?? defaultEntitySlugFromEnv();
  let defaultEntityId = str(raw, 'defaultEntityId').toLowerCase() || fallbackDefault;
  if (!entities.some((e) => e.id === defaultEntityId)) {
    defaultEntityId = fallbackDefault;
  }
  if (!activeEntities.some((e) => e.id === defaultEntityId) && activeEntities.length > 0) {
    defaultEntityId = activeEntities[0]!.id;
  }

  return {
    multiEntityEnabled: bool(raw, 'multiEntityEnabled', false),
    entities,
    defaultEntityId,
  };
}

export async function loadOperatingEntitiesSettings(): Promise<OperatingEntitiesSettings> {
  if (!process.env.DATABASE_URL) {
    const setup = await loadCompanySetupSettings();
    return buildDefaultOperatingEntitiesSettings(setup.orgName || undefined);
  }
  try {
    const row = await prisma.systemSetting.findUnique({
      where: systemSettingWhere(DEFAULT_ORGANIZATION_ID, OPERATING_ENTITIES_SETTINGS_KEY),
    });
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

export function getActiveEntities(settings: OperatingEntitiesSettings): OperatingEntity[] {
  return settings.entities.filter((e) => e.isActive);
}

export function shouldShowEntitySwitcher(settings: OperatingEntitiesSettings): boolean {
  if (!settings.multiEntityEnabled) return false;
  return filterEntitiesForEntitySwitcher(getActiveEntities(settings)).length > 1;
}

export function validateEntitySlug(slug: string | null | undefined, settings: OperatingEntitiesSettings): string | null {
  if (!slug) return null;
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const active = getActiveEntities(settings);
  return active.some((e) => e.id === normalized) ? normalized : null;
}

export function resolveEntitySlugOrDefault(
  slug: string | null | undefined,
  settings: OperatingEntitiesSettings,
): string {
  const validated = validateEntitySlug(slug, settings);
  if (validated) return validated;
  const normalized = slug?.trim().toLowerCase();
  if (normalized && isMultiContextDemoEnabled()) {
    const pack = parseVerticalShowcasePackFromEntitySlug(normalized);
    if (pack) {
      const keSlug = `${pack}__ke`;
      const ke = validateEntitySlug(keSlug, settings);
      if (ke) return ke;
    }
  }
  return settings.defaultEntityId;
}

export function toPublicEntity(entity: OperatingEntity): PublicEntity {
  const profile = COUNTRY_PROFILES[entity.countryCode];
  const vertical = parseVerticalFromEntitySlug(entity.id);
  return {
    id: entity.id,
    name: entity.legalName,
    country: profile.country,
    countryCode: entity.countryCode,
    currency: entity.currency,
    flag: profile.flag,
    color: profile.color,
    sector: vertical?.sector,
  };
}

export function toPublicEntities(settings: OperatingEntitiesSettings): PublicEntity[] {
  return filterEntitiesForEntitySwitcher(getActiveEntities(settings)).map(toPublicEntity);
}

export type OperatingEntitiesValidationError = { field: string; message: string };

export function validateOperatingEntitiesPatch(
  patch: OperatingEntitiesSettings,
): OperatingEntitiesValidationError[] {
  const errors: OperatingEntitiesValidationError[] = [];
  const active = getActiveEntities(patch);

  if (active.length === 0) {
    errors.push({ field: 'entities', message: 'At least one active entity is required.' });
  }

  const slugs = new Set<string>();
  for (const entity of patch.entities) {
    if (!SLUG_PATTERN.test(entity.id)) {
      errors.push({ field: `entities.${entity.id}`, message: 'Entity slug must be lowercase letters, numbers, hyphens.' });
    }
    if (slugs.has(entity.id)) {
      errors.push({ field: `entities.${entity.id}`, message: 'Duplicate entity slug.' });
    }
    slugs.add(entity.id);
    if (!entity.legalName.trim()) {
      errors.push({ field: `entities.${entity.id}.legalName`, message: 'Legal name is required.' });
    }
    if (!entity.employeeNumberPrefix.trim()) {
      errors.push({ field: `entities.${entity.id}.employeeNumberPrefix`, message: 'Employee number prefix is required.' });
    }
  }

  if (!patch.entities.some((e) => e.id === patch.defaultEntityId)) {
    errors.push({ field: 'defaultEntityId', message: 'Default entity must exist in the entity list.' });
  }

  const defaultEntity = patch.entities.find((e) => e.id === patch.defaultEntityId);
  if (defaultEntity && !defaultEntity.isActive) {
    errors.push({ field: 'defaultEntityId', message: 'Default entity cannot be inactive — pick another default first.' });
  }

  if (patch.multiEntityEnabled && active.length < 2) {
    errors.push({
      field: 'multiEntityEnabled',
      message: 'Multi-entity mode requires at least two active entities.',
    });
  }

  return errors;
}

/** Upsert OutsourcingClient rows to mirror configured operating entities. */
export async function syncOperatingEntitiesToOutsourcingClients(
  db: PrismaClient,
  settings: OperatingEntitiesSettings,
): Promise<void> {
  for (const entity of settings.entities) {
    const entityCode = entity.id;
    const profile = COUNTRY_PROFILES[entity.countryCode];
    const existing = await db.outsourcingClient.findFirst({ where: { entityCode } });

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
      await db.outsourcingClient.create({ data });
    }
  }
}

export { isMultiEntityEnvEnabled, getDefaultCurrency };
