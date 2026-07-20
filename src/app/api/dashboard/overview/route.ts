import { NextRequest, NextResponse } from 'next/server';
import { loadCompanySetupSettingsForOrg } from '@/lib/company-setup';
import { reportApiError } from '@/lib/monitoring';
import { resolveEffectiveModules, type ModuleKey } from '@/lib/modules';
import {
  resolveSessionEntitlements,
  subscriptionFromEntitlements,
} from '@/lib/resolve-session-entitlements';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withOrgContext } from '@/lib/org-context';
import { getEffectiveModulesFromRequest } from '@/lib/module-access';
import {
  loadOverviewCoreMetrics,
  loadOverviewDetailsMetrics,
  OVERVIEW_READ_TX_TIMEOUT_MS,
} from '@/lib/dashboard-overview-metrics';
import { withTenant } from '@/lib/tenant-api';
import { userRowToSummary } from '@/lib/user-summary-api';

export const dynamic = 'force-dynamic';

/** GET — aggregated dashboard overview payload (single round-trip for /dashboard). */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const metricsOnly = request.nextUrl.searchParams.get('metricsOnly') === '1';
    const sliceParam = request.nextUrl.searchParams.get('slice');
    const slice = sliceParam === 'core' || sliceParam === 'details' ? sliceParam : 'all';
    const loadCore = slice === 'all' || slice === 'core';
    const loadDetails = slice === 'all' || slice === 'details';

    try {
      const setup = metricsOnly ? null : await loadCompanySetupSettingsForOrg(ctx.organizationId);
      const entitlements = metricsOnly
        ? null
        : await resolveSessionEntitlements(ctx.organizationId);
      const subscription = subscriptionFromEntitlements(entitlements);
      const modules = metricsOnly
        ? getEffectiveModulesFromRequest(request)
        : resolveEffectiveModules(setup!.moduleAdminFlags, subscription);

      // Everything runs in a single tenant transaction (one pooled connection).
      // Core metrics collapse to one combined SQL round-trip; resolving the
      // client and loading the user/details reuse the same connection, avoiding
      // extra connection acquisitions that dominate latency on a remote DB.
      const dbResult = await withOrgContext(
        ctx.organizationId,
        async (tx) => {
          const clientId = await resolvePrimaryWorkspaceClientId(
            tx,
            undefined,
            request,
            ctx.organizationId,
          );

          let fullUser = null;
          if (!metricsOnly) {
            fullUser = await tx.user.findUnique({ where: { id: ctx.staff.id } });
            if (!fullUser) return { notFound: true as const };
          }

          const [coreMetrics, detailsMetrics] = await Promise.all([
            loadCore
              ? loadOverviewCoreMetrics(tx, {
                  organizationId: ctx.organizationId,
                  staff: ctx.staff,
                  clientId,
                  enabledModules: modules,
                })
              : Promise.resolve(null),
            loadDetails
              ? loadOverviewDetailsMetrics(tx, {
                  organizationId: ctx.organizationId,
                  staff: ctx.staff,
                  clientId,
                  enabledModules: modules,
                })
              : Promise.resolve(null),
          ]);

          return { notFound: false as const, fullUser, coreMetrics, detailsMetrics };
        },
        { timeout: OVERVIEW_READ_TX_TIMEOUT_MS },
      );

      if (dbResult.notFound) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }

      const { fullUser, coreMetrics, detailsMetrics } = dbResult;
      const me = metricsOnly ? null : await userRowToSummary(fullUser!);

      return NextResponse.json({
        ...(me ? { me } : {}),
        ...(modules && !metricsOnly ? { modules } : {}),
        ...(coreMetrics
          ? {
              totalStaff: coreMetrics.totalStaff,
              onDuty: coreMetrics.onDuty,
              onLeave: coreMetrics.onLeave,
              pendingApprovals: coreMetrics.pendingApprovals,
              openAttendanceExceptions: coreMetrics.openAttendanceExceptions,
              payroll: coreMetrics.payroll,
              credentialsExpiring: coreMetrics.credentialsExpiring,
              credentialsExpired: coreMetrics.credentialsExpired,
              unreadNotifications: coreMetrics.unreadNotifications,
              crossModule: coreMetrics.crossModule,
            }
          : {}),
        ...(detailsMetrics ?? {}),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/dashboard/overview',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load dashboard overview.' }, { status: 500 });
    }
  });
}
