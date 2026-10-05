import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { loadCompanySetupSettingsForOrg } from '@/lib/company-setup';
import { reportApiError } from '@/lib/monitoring';
import { resolveEffectiveModules } from '@/lib/modules';
import {
  resolveSessionEntitlements,
  subscriptionFromEntitlements,
} from '@/lib/resolve-session-entitlements';
import { withTenant } from '@/lib/tenant-api';
import { withOrgContext } from '@/lib/org-context';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { OVERVIEW_READ_TX_TIMEOUT_MS } from '@/lib/dashboard-overview-metrics';
import { expandAttentionQueue } from '@/lib/dashboard-attention/expand-queue';
import type { AttentionQueueId } from '@/lib/dashboard-attention/work-items';

export const dynamic = 'force-dynamic';

const QUEUE_IDS = new Set<string>([
  'leave',
  'attendance',
  'onboarding',
  'invoices',
  'vendor-bills',
  'purchase-requests',
  'fleet-incidents',
  'sales-past-due',
  'sales-stalled',
  'credentials',
]);

/**
 * Cheap badge fallback — leave + today's open attendance only.
 * Prefer the overview core session cache on the client; this exists for cold
 * navigations that never hit Overview.
 */
async function loadAttentionBadgeCounts(
  tx: Prisma.TransactionClient,
  clientId: string,
): Promise<number> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const scopedEmployeeIds = Prisma.sql`SELECT "id" FROM "Employee" WHERE "outsourcingClientId" = ${clientId}`;
  const rows = await tx.$queryRaw<
    Array<{ leavePending: number; staffLeavePending: number; openAttendance: number }>
  >(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::int FROM "LeaveApplication" WHERE "status"::text = 'pending' AND "employeeId" IN (${scopedEmployeeIds})) AS "leavePending",
        (SELECT COUNT(*)::int FROM "StaffLeaveApplication" WHERE "status"::text = 'pending') AS "staffLeavePending",
        (SELECT COUNT(*)::int FROM "AttendanceException" WHERE "status"::text = 'open' AND "workDate" = ${todayStr}::date AND "employeeId" IN (${scopedEmployeeIds})) AS "openAttendance"
    `);
  const r = rows[0];
  if (!r) return 0;
  let total = 0;
  if (r.leavePending + r.staffLeavePending > 0) total += 1;
  if (r.openAttendance > 0) total += 1;
  return total;
}

/** GET — item-level Action Center queue (or ?summaryOnly=1 for cheap nav badge). */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const summaryOnly = request.nextUrl.searchParams.get('summaryOnly') === '1';
    const queueParam = request.nextUrl.searchParams.get('type')?.trim() || null;
    const queueId =
      queueParam && QUEUE_IDS.has(queueParam) ? (queueParam as AttentionQueueId) : null;

    try {
      const setup = await loadCompanySetupSettingsForOrg(ctx.organizationId);
      const entitlements = await resolveSessionEntitlements(ctx.organizationId);
      const subscription = subscriptionFromEntitlements(entitlements);
      const modules = resolveEffectiveModules(setup.moduleAdminFlags, subscription);

      if (summaryOnly) {
        const total = await withOrgContext(
          ctx.organizationId,
          async (tx) => {
            const clientId = await resolvePrimaryWorkspaceClientId(
              tx,
              undefined,
              request,
              ctx.organizationId,
            );
            return loadAttentionBadgeCounts(tx, clientId);
          },
          { timeout: OVERVIEW_READ_TX_TIMEOUT_MS },
        );
        return NextResponse.json({
          summary: { total, critical: 0, byQueue: {} },
          items: [],
        });
      }

      const result = await expandAttentionQueue(ctx, { modules, queueId });

      return NextResponse.json({
        summary: result.summary,
        items: result.items,
        hasMoreByQueue: result.hasMoreByQueue,
        modules,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/dashboard/attention',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load action center.' }, { status: 500 });
    }
  });
}
