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

export async function GET(request: NextRequest) {
  const { error } = await requireAdminActor(request);
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
    return NextResponse.json({
      ...setup,
      storageKey,
      activeContextLabel: companySetupContextLabel(entitySlug),
      public: toPublicCompanySetup(setup),
      resolvedBrand: resolvePublicBrand(setup),
      themePreview: buildBrandThemeCssVars(setup.primaryColor, setup.secondaryColor),
      provisioning: buildProvisioningChecklist(setup),
      defaults: DEFAULT_COMPANY_SETUP,
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
  const merged = sanitizeCompanySetup({ ...current, ...(body as Partial<CompanySetupSettings>) });

  const violations = findModuleAdminViolations(merged.moduleAdminFlags, entitlements);
  if (violations.length > 0) {
    return NextResponse.json(moduleNotEntitledResponse(violations), { status: 403 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    await persistCompanySetupSettings(storageKey, merged, actor?.userId ?? null);

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
