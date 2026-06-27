import { cookies } from 'next/headers';
import { loadCompanySetupSettings } from '@/lib/company-setup';
import { resolvePublicBrand } from '@/lib/resolve-public-brand';
import type { PublicBrand } from '@/lib/brand';
import { HRIS_ENTITY_COOKIE } from '@/lib/entity-constants';
import { parseDemoEntitySlug } from '@/lib/demo-entity-slug';
import {
  getActiveEntities,
  loadOperatingEntitiesSettings,
  resolveEntitySlugOrDefault,
} from '@/lib/operating-entities';
import { recruitmentEmployerNameFromEnv } from '@/lib/recruitment-workspace';
import { isDemoSandboxCell } from '@/lib/deployment-cell';

/** Stale outsourcing demo rows that must not drive public careers branding. */
const LEGACY_CAREERS_EMPLOYER = /nyati\s+sacco/i;

function shouldPreferEnvCareersEmployer(operatingEntityLegalName: string | undefined): boolean {
  if (isDemoSandboxCell()) return true;
  const legal = operatingEntityLegalName?.trim();
  return Boolean(legal && LEGACY_CAREERS_EMPLOYER.test(legal));
}

export async function getResolvedPublicBrand(): Promise<PublicBrand> {
  const cookieStore = await cookies();
  const rawSlug = cookieStore.get(HRIS_ENTITY_COOKIE)?.value ?? null;

  const entitySettings = await loadOperatingEntitiesSettings();
  const resolvedSlug = resolveEntitySlugOrDefault(rawSlug, entitySettings);
  const operatingEntity = getActiveEntities(entitySettings).find((e) => e.id === resolvedSlug);

  const { contextId } = parseDemoEntitySlug(resolvedSlug);
  const setup = await loadCompanySetupSettings(contextId);
  const brand = resolvePublicBrand(setup);

  const orgName = operatingEntity?.legalName?.trim();

  if (shouldPreferEnvCareersEmployer(orgName)) {
    const envEmployer = recruitmentEmployerNameFromEnv();
    return {
      ...brand,
      orgName: envEmployer,
      payslipLegalName: envEmployer,
      careersEmployerName: envEmployer,
    };
  }

  if (!orgName) return brand;

  return {
    ...brand,
    orgName,
    payslipLegalName: orgName,
    careersEmployerName: setup.careersEmployerName?.trim() || orgName,
  };
}
