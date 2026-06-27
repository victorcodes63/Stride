import { NextRequest, NextResponse } from 'next/server';
import { loadCompanySetupSettingsForOrg } from '@/lib/company-setup';
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
import { moduleAdminFlagsSetCookieHeader } from '@/lib/module-cookie';
import { entitlementsSetCookieHeader } from '@/lib/entitlements-cookie';
import {
  isControlPlaneSyncConfigured,
  syncDeploymentEntitlements,
} from '@/lib/entitlements-resolver';
import { loadDeploymentEntitlements } from '@/lib/entitlements-store';
import { loadOrganizationEntitlements } from '@/lib/org-entitlements-store';
import { isEntitlementsStale } from '@/lib/entitlements-types';
import { planIdToTier } from '@/lib/entitlements-resolver';
import { isModuleEntitled } from '@/lib/entitlements-guard';
import { getDeploymentTier } from '@/lib/deployment-tier';
import { withTenant } from '@/lib/tenant-api';
import { listActiveMemberships } from '@/lib/org-membership';
import { prisma } from '@/lib/prisma';
import { userRowToSummary } from '@/lib/user-summary-api';

export const dynamic = 'force-dynamic';

/** GET — session user, module flags, and entity switcher config in one round-trip. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    try {
      const [fullUser, setup, entitySettings, memberships] = await Promise.all([
        ctx.run((tx) => tx.user.findUnique({ where: { id: ctx.staff.id } })),
        loadCompanySetupSettingsForOrg(ctx.organizationId),
        loadOperatingEntitiesSettingsForOrg(ctx.organizationId),
        ctx.run((tx) => listActiveMemberships(ctx.staff.id, tx as typeof prisma)),
      ]);

      if (!fullUser) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }

      const licensed = listLicensedModules();
      const moduleAdminFlags = setup.moduleAdminFlags;

      let entitlements = await loadOrganizationEntitlements(ctx.organizationId);
      if (!entitlements) {
        entitlements = await loadDeploymentEntitlements();
      }
      if (
        isControlPlaneSyncConfigured() &&
        (!entitlements || isEntitlementsStale(entitlements.syncedAt))
      ) {
        // Refresh in background — do not block dashboard shell on control-plane latency.
        void syncDeploymentEntitlements().catch(() => {});
      }

      const subscription = entitlements
        ? {
            subscribedModules: entitlements.modules,
            accountStatus: entitlements.accountStatus,
            verticalEnginesAllowed: entitlements.verticalEnginesAllowed,
          }
        : undefined;

      const modules = resolveEffectiveModules(moduleAdminFlags, subscription);
      const deploymentTier = entitlements
        ? planIdToTier(entitlements.planId)
        : getDeploymentTier();
      const entities = toPublicEntities(entitySettings);

      const current =
        memberships.find((m) => m.organizationId === ctx.organizationId) ?? memberships[0] ?? null;
      const organizations = memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
      }));

      const response = NextResponse.json({
        me: await userRowToSummary(fullUser, {
          currentOrgId: current?.organizationId ?? ctx.organizationId,
          currentOrgName: current?.organization.name ?? null,
          organizations,
        }),
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
