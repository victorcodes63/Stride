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
  if (!orgName) return brand;

  return {
    ...brand,
    orgName,
    payslipLegalName: orgName,
    careersEmployerName: setup.careersEmployerName?.trim() || orgName,
  };
}
