import { NextRequest, NextResponse } from 'next/server';
import {
  companySetupStorageKeyFromRequest,
  loadCompanySetupForStorageKey,
} from '@/lib/company-setup';
import { getAuthProvidersSummary } from '@/lib/auth-providers';
import { getDeploymentSummary } from '@/lib/deployment-config';
import { reportApiError } from '@/lib/monitoring';
import {
  isMultiEntityEnvEnabled,
  loadOperatingEntitiesSettingsForOrg,
  shouldShowEntitySwitcher,
  toPublicEntities,
} from '@/lib/operating-entities';
import { listLicensedModules, MODULE_DEFINITIONS, resolveEffectiveModules } from '@/lib/modules';
import { getDemoModuleAdminFlags } from '@/lib/demo-vertical-module-packs';
import { isMultiContextDemoEnabled, parseDemoEntitySlug } from '@/lib/demo-entity-slug';
import { HRIS_ENTITY_COOKIE } from '@/lib/entity-constants';
import { moduleAdminFlagsSetCookieHeader } from '@/lib/module-cookie';
import { entitlementsSetCookieHeader } from '@/lib/entitlements-cookie';
import { withTenant } from '@/lib/tenant-api';
import { listActiveMemberships } from '@/lib/org-membership';
import { prisma } from '@/lib/prisma';
import { userRowToSummary } from '@/lib/user-summary-api';
import {
  resolveSessionEntitlements,
  subscriptionFromEntitlements,
} from '@/lib/resolve-session-entitlements';
import { planIdToTier } from '@/lib/entitlements-resolver';
import { isModuleEntitled } from '@/lib/entitlements-guard';
import { getDeploymentTier } from '@/lib/deployment-tier';
import {
  isLayoutCustomized,
  parseDashboardOverviewLayout,
  sanitizeDashboardOverviewLayout,
} from '@/lib/dashboard-overview-preferences';

export const dynamic = 'force-dynamic';

/** GET — session user, module flags, and entity switcher config in one round-trip. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    try {
      const storageKey = companySetupStorageKeyFromRequest(request);
      const [fullUser, setup, entitySettings, memberships, entitlements] = await Promise.all([
        ctx.run((tx) => tx.user.findUnique({ where: { id: ctx.staff.id } })),
        loadCompanySetupForStorageKey(storageKey, ctx.organizationId),
        loadOperatingEntitiesSettingsForOrg(ctx.organizationId),
        ctx.run((tx) => listActiveMemberships(ctx.staff.id, tx as typeof prisma)),
        resolveSessionEntitlements(ctx.organizationId),
      ]);

      if (!fullUser) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }

      const licensed = listLicensedModules();
      let moduleAdminFlags = setup.moduleAdminFlags;
      // Multi-vertical demo: nav packs come from the entity cookie (or default company).
      if (isMultiContextDemoEnabled()) {
        const entitySlug =
          request.cookies.get(HRIS_ENTITY_COOKIE)?.value ??
          entitySettings.defaultEntityId ??
          null;
        if (entitySlug?.includes('__')) {
          const { contextId } = parseDemoEntitySlug(entitySlug);
          moduleAdminFlags = getDemoModuleAdminFlags(contextId);
        }
      }

      const subscription = subscriptionFromEntitlements(entitlements);

      const modules = resolveEffectiveModules(moduleAdminFlags, subscription);
      const deploymentTier = entitlements
        ? planIdToTier(entitlements.planId)
        : getDeploymentTier();
      const entities = toPublicEntities(entitySettings);

      const overviewLayout = sanitizeDashboardOverviewLayout(
        parseDashboardOverviewLayout(fullUser.dashboardOverviewLayout),
      );

      const current =
        memberships.find((m) => m.organizationId === ctx.organizationId) ?? memberships[0] ?? null;
      const organizations = memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
      }));

      const me = await userRowToSummary(fullUser, {
        currentOrgId: current?.organizationId ?? ctx.organizationId,
        currentOrgName: current?.organization.name ?? null,
        organizations,
      });

      const response = NextResponse.json({
        me,
        overviewLayout,
        overviewLayoutIsCustom: isLayoutCustomized(overviewLayout),
        deployment: getDeploymentSummary(),
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
          entitled: isModuleEntitled(key, entitlements),
          adminEnabled: moduleAdminFlags[key],
          enabled: modules[key],
        })),
        entities,
        defaultEntityId: entitySettings.defaultEntityId,
        showEntitySwitcher: shouldShowEntitySwitcher(entitySettings),
        multiEntityEnabled: entitySettings.multiEntityEnabled,
        multiEntityEnvEnabled: isMultiEntityEnvEnabled(),
        deploymentTier,
        entitlements: entitlements
          ? {
              planId: entitlements.planId,
              accountStatus: entitlements.accountStatus,
              pastDueSince: entitlements.pastDueSince ?? null,
              horizontalQuota: entitlements.horizontalQuota,
              verticalEnginesAllowed: entitlements.verticalEnginesAllowed,
              syncedAt: entitlements.syncedAt,
            }
          : null,
      });

      response.headers.append('Set-Cookie', moduleAdminFlagsSetCookieHeader(moduleAdminFlags));
      if (entitlements) {
        response.headers.append('Set-Cookie', entitlementsSetCookieHeader(entitlements));
      }
      return response;
    } catch (error) {
      await reportApiError({
        route: 'GET /api/dashboard/bootstrap',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load dashboard session.' }, { status: 500 });
    }
  });
}
