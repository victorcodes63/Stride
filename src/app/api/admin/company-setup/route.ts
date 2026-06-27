import { NextRequest, NextResponse } from 'next/server';
import { requireAdminActor } from '@/lib/admin-security';
import { companySetupAccessDeniedResponse } from '@/lib/company-setup-access';
import { logAuditEvent } from '@/lib/audit-events';
import {
  buildProvisioningChecklist,
  companySetupContextLabel,
  companySetupStorageKeyFromRequest,
  DEFAULT_COMPANY_SETUP,
  loadCompanySetupForStorageKey,
  persistCompanySetupSettings,
  sanitizeCompanySetup,
  toPublicCompanySetup,
  type CompanySetupSettings,
} from '@/lib/company-setup';
import { resolvePublicBrand } from '@/lib/resolve-public-brand';
import { buildBrandThemeCssVars } from '@/lib/brand-theme';
import { moduleAdminFlagsSetCookieHeader } from '@/lib/module-cookie';
import {
  findModuleAdminViolations,
  isModuleEntitled,
  loadEntitlementsForAdminGuard,
  moduleNotEntitledResponse,
} from '@/lib/entitlements-guard';
import {
  listLicensedModules,
  MODULE_DEFINITIONS,
  resolveEffectiveModules,
  type ModuleKey,
} from '@/lib/modules';
import { HRIS_ENTITY_COOKIE } from '@/lib/entity-constants';
import { getDeploymentTier } from '@/lib/deployment-tier';
import {
  enforceCompanySetupTier,
  getCompanySetupCapabilities,
} from '@/lib/company-setup-tier-features';
import { isGoogleOAuthConfigured, isMicrosoftOAuthConfigured } from '@/lib/auth-providers';
import { applyAuthMethodToSetup, type PortalAuthMethod } from '@/lib/company-setup-auth';
import { syncCompanySetupToOrgAuth } from '@/lib/auth/sync-company-setup-auth';
import { listOrganizationEmailDomains, formatDnsTxtRecord } from '@/lib/auth/domain-verification';

export async function GET(request: NextRequest) {
  const { error, actor } = await requireAdminActor(request);
  if (error) return error;
  const tierDenied = companySetupAccessDeniedResponse();
  if (tierDenied) return tierDenied;

  try {
    const storageKey = companySetupStorageKeyFromRequest(request);
    const entitySlug = request.cookies.get(HRIS_ENTITY_COOKIE)?.value ?? null;
    const setup = await loadCompanySetupForStorageKey(storageKey);
    const licensed = listLicensedModules();
    const entitlements = await loadEntitlementsForAdminGuard();
    const subscription = entitlements
      ? {
          subscribedModules: entitlements.modules,
          accountStatus: entitlements.accountStatus,
          verticalEnginesAllowed: entitlements.verticalEnginesAllowed,
        }
      : undefined;
    const modules = resolveEffectiveModules(setup.moduleAdminFlags, subscription);
    const tier = getDeploymentTier();
    const capabilities = getCompanySetupCapabilities(tier);
    const oauthConfigured = {
      microsoft: isMicrosoftOAuthConfigured(),
      google: isGoogleOAuthConfigured(),
    };
    const organizationId = actor?.organizationId;
    const emailDomains =
      organizationId != null
        ? (await listOrganizationEmailDomains(organizationId)).map((d) => ({
            id: d.id,
            domain: d.domain,
            verified: Boolean(d.verifiedAt),
            verifiedAt: d.verifiedAt?.toISOString() ?? null,
            txtRecord: formatDnsTxtRecord(d.verificationToken),
          }))
        : [];
    return NextResponse.json({
      ...setup,
      storageKey,
      activeContextLabel: companySetupContextLabel(entitySlug),
      public: toPublicCompanySetup(setup),
      resolvedBrand: resolvePublicBrand(setup),
      themePreview: buildBrandThemeCssVars(setup.primaryColor, setup.secondaryColor),
      provisioning: buildProvisioningChecklist(setup),
      defaults: DEFAULT_COMPANY_SETUP,
      capabilities,
      oauthConfigured,
      emailDomains,
      moduleCatalog: MODULE_DEFINITIONS.map(({ key, label, description, canDisable }) => ({
        key,
        label,
        description,
        canDisable,
        licensed: licensed[key],
        entitled: isModuleEntitled(key, entitlements),
        adminEnabled: setup.moduleAdminFlags[key],
        enabled: modules[key],
      })),
    });
  } catch (e) {
    console.error('GET /api/admin/company-setup error:', e);
    return NextResponse.json({ error: 'Failed to load company setup.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { error, actor } = await requireAdminActor(request);
  if (error) return error;
  const tierDenied = companySetupAccessDeniedResponse();
  if (tierDenied) return tierDenied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const storageKey = companySetupStorageKeyFromRequest(request);
  const current = await loadCompanySetupForStorageKey(storageKey);
  const entitlements = await loadEntitlementsForAdminGuard();
  const tier = getDeploymentTier();
  const capabilities = getCompanySetupCapabilities(tier);
  const oauthConfigured = {
    microsoft: isMicrosoftOAuthConfigured(),
    google: isGoogleOAuthConfigured(),
  };

  let merged = sanitizeCompanySetup({ ...current, ...(body as Partial<CompanySetupSettings>) });

  if (capabilities.canConfigureAuthPolicy) {
    const payload = body as Partial<CompanySetupSettings>;
    if (payload.staffAuthMethod) {
      if (!capabilities.allowedAuthMethods.includes(payload.staffAuthMethod)) {
        return NextResponse.json({ error: 'That staff sign-in method is not available on your plan.' }, { status: 403 });
      }
      merged = applyAuthMethodToSetup(merged, 'staff', payload.staffAuthMethod);
    }
    if (payload.essAuthMethod) {
      if (!capabilities.allowedAuthMethods.includes(payload.essAuthMethod)) {
        return NextResponse.json({ error: 'That ESS sign-in method is not available on your plan.' }, { status: 403 });
      }
      merged = applyAuthMethodToSetup(merged, 'ess', payload.essAuthMethod as PortalAuthMethod);
    }
  }

  merged = enforceCompanySetupTier(merged, capabilities, oauthConfigured);

  const violations = findModuleAdminViolations(merged.moduleAdminFlags, entitlements);
  if (violations.length > 0) {
    return NextResponse.json(moduleNotEntitledResponse(violations), { status: 403 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    await persistCompanySetupSettings(storageKey, merged, actor?.userId ?? null);

    if (actor?.organizationId) {
      const bodyObj = body as Record<string, unknown>;
      await syncCompanySetupToOrgAuth(actor.organizationId, merged, {
        ssoEnforcedStaff: bodyObj.ssoEnforcedStaff === true,
        ssoEnforcedEss: bodyObj.ssoEnforcedEss === true,
        jitProvisioning: bodyObj.jitProvisioning === true,
        lockedMsTenantId:
          typeof bodyObj.lockedMsTenantId === 'string' ? bodyObj.lockedMsTenantId : undefined,
      });
    }

    await logAuditEvent({
      actor,
      action: 'company_setup.updated',
      entityType: 'SystemSetting',
      entityId: storageKey,
      route: '/api/admin/company-setup',
      metadata: merged,
    });

    const response = NextResponse.json({
      ...merged,
      storageKey,
      activeContextLabel: companySetupContextLabel(request.cookies.get(HRIS_ENTITY_COOKIE)?.value ?? null),
      public: toPublicCompanySetup(merged),
    });
    response.headers.append('Set-Cookie', moduleAdminFlagsSetCookieHeader(merged.moduleAdminFlags));
    return response;
  } catch (e) {
    console.error('PATCH /api/admin/company-setup error:', e);
    return NextResponse.json({ error: 'Failed to save company setup.' }, { status: 500 });
  }
}
