import { NextResponse } from 'next/server';
import { getAuthProvidersSummary } from '@/lib/auth-providers';
import { loadCompanySetupSettings, toPublicCompanySetup } from '@/lib/company-setup';
import { getResolvedPublicBrand } from '@/lib/get-resolved-public-brand';
import { getDeploymentSummary } from '@/lib/deployment-config';
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

export const dynamic = 'force-dynamic';

/**
 * Public deployment metadata for client nav, provisioning checks, and operator tooling.
 * Module flags merge env license with Company Setup admin toggles.
 */
export async function GET() {
  const setup = await loadCompanySetupSettings();
  const licensed = listLicensedModules();
  const moduleAdminFlags = setup.moduleAdminFlags;
  const modules = resolveEffectiveModules(moduleAdminFlags);
  const featureFlags = listFeatureFlags();
  const companySetup = toPublicCompanySetup(setup);
  const brand = await getResolvedPublicBrand();
  const entitySettings = await loadOperatingEntitiesSettings();

  const response = NextResponse.json({
    ...getDeploymentSummary(),
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
