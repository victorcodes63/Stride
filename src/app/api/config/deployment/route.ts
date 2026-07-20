import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvidersSummary } from '@/lib/auth-providers';
import {
  COMPANY_SETUP_SETTINGS_KEY,
  companySetupStorageKeyFromRequest,
  loadCompanySetupForStorageKey,
  loadCompanySetupSettings,
  toPublicCompanySetup,
} from '@/lib/company-setup';
import { getResolvedPublicBrand } from '@/lib/get-resolved-public-brand';
import { getDeploymentSummaryAsync } from '@/lib/deployment-config';
import {
  listLicensedModules,
  MODULE_DEFINITIONS,
  resolveEffectiveModules,
} from '@/lib/modules';
import { moduleAdminFlagsSetCookieHeader } from '@/lib/module-cookie';
import { listFeatureFlags } from '@/lib/feature-flags';
import {
  isMultiEntityEnvEnabled,
  loadOperatingEntitiesSettings,
  shouldShowEntitySwitcher,
  toPublicEntities,
} from '@/lib/operating-entities';
import { parseDemoEntitySlug, isMultiContextDemoEnabled } from '@/lib/demo-entity-slug';
import { HRIS_ENTITY_COOKIE } from '@/lib/entity-constants';
import { getDemoModuleAdminFlags } from '@/lib/demo-vertical-module-packs';

export const dynamic = 'force-dynamic';

/**
 * Public deployment metadata for client nav, provisioning checks, and operator tooling.
 * Module flags merge env license with Company Setup admin toggles.
 * In multi-vertical demo, prefer pack flags from the entity cookie (DB row or pack map fallback).
 */
export async function GET(request: NextRequest) {
  const entitySettings = await loadOperatingEntitiesSettings();
  const storageKey = companySetupStorageKeyFromRequest(request);
  const entitySlug =
    request.cookies.get(HRIS_ENTITY_COOKIE)?.value ??
    entitySettings.defaultEntityId ??
    null;
  const contextId =
    entitySlug && entitySlug.includes('__')
      ? parseDemoEntitySlug(entitySlug).contextId
      : null;

  let setup =
    storageKey !== COMPANY_SETUP_SETTINGS_KEY
      ? await loadCompanySetupForStorageKey(storageKey)
      : await loadCompanySetupSettings(contextId);

  // Live multi-vertical: pack rows live on the tenant org, not DEFAULT_ORGANIZATION_ID.
  // If the DEFAULT-scoped load still has all-on flags, overlay the canonical pack map.
  if (isMultiContextDemoEnabled() && contextId) {
    const packFlags = getDemoModuleAdminFlags(contextId);
    const allOn = Object.values(setup.moduleAdminFlags).every(Boolean);
    const packHidesSomething = Object.values(packFlags).some((v) => v === false);
    if (allOn && packHidesSomething) {
      setup = { ...setup, moduleAdminFlags: packFlags };
    }
  }

  const licensed = listLicensedModules();
  const moduleAdminFlags = setup.moduleAdminFlags;
  const modules = resolveEffectiveModules(moduleAdminFlags);
  const featureFlags = listFeatureFlags();
  const companySetup = toPublicCompanySetup(setup);
  const brand = await getResolvedPublicBrand();

  const response = NextResponse.json({
    ...(await getDeploymentSummaryAsync()),
    companySetup,
    brand,
    authProviders: getAuthProvidersSummary(),
    modules,
    moduleAdminFlags,
    moduleCatalog: MODULE_DEFINITIONS.map(({ key, label, envVar, description, canDisable }) => ({
      key,
      label,
      envVar,
      description,
      canDisable,
      licensed: licensed[key],
      adminEnabled: moduleAdminFlags[key],
      enabled: modules[key],
    })),
    featureFlags,
    multiEntityEnvEnabled: isMultiEntityEnvEnabled(),
    multiEntityEnabled: entitySettings.multiEntityEnabled,
    entities: toPublicEntities(entitySettings),
    defaultEntityId: entitySettings.defaultEntityId,
    showEntitySwitcher: shouldShowEntitySwitcher(entitySettings),
  });

  response.headers.append('Set-Cookie', moduleAdminFlagsSetCookieHeader(moduleAdminFlags));
  return response;
}
