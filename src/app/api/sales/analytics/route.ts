import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import {
  avgWonDealValue,
  computeWinRate,
  dealIdleDays,
  funnelByStage,
  isDealRotting,
  monthlyTrend,
  stageConversionRates,
  type AnalyticsDeal,
} from '@/lib/sales/analytics';
import { resolveEmployeeIdForStaff } from '@/lib/sales/api-helpers';
import {
  OPEN_PIPELINE_STAGES,
  parsePeriodBounds,
  type SalesDealStage,
  type SalesTargetPeriodType,
} from '@/lib/sales/schema';
import { canViewAllSalesDeals } from '@/lib/staff-permissions';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type AgingBucket = { bucket: string; label: string; count: number; value: number };

const AGING_BUCKETS: Array<{ bucket: string; label: string; min: number; max: number }> = [
  { bucket: 'fresh', label: '0–7 days', min: 0, max: 7 },
  { bucket: 'aging', label: '8–14 days', min: 8, max: 14 },
  { bucket: 'stale', label: '15–30 days', min: 15, max: 30 },
  { bucket: 'cold', label: '31–60 days', min: 31, max: 60 },
  { bucket: 'frozen', label: '60+ days', min: 61, max: Number.POSITIVE_INFINITY },
];

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const params = request.nextUrl.searchParams;
    const monthsRaw = Number.parseInt(params.get('months') ?? '', 10);
    const months = Number.isFinite(monthsRaw) ? Math.min(24, Math.max(1, monthsRaw)) : 6;

    const periodParam = (params.get('period')?.trim() || 'month') as SalesTargetPeriodType;
    const periodType: SalesTargetPeriodType =
      periodParam === 'quarter' || periodParam === 'year' ? periodParam : 'month';
    const anchorStr = params.get('periodStart')?.trim();
    const anchor = anchorStr ? new Date(`${anchorStr}T00:00:00.000Z`) : new Date();
    const { periodStart, periodEnd } = parsePeriodBounds(periodType, anchor);

    try {
      const now = new Date();
      const analytics = await ctx.run(async (tx) => {
        // Per-viewer scoping: reps only see their own deals/activities.
        const seeAll = canViewAllSalesDeals(ctx.staff.role, ctx.staff.staffUserType);
        const viewerEmployeeId = seeAll
          ? null
          : (await resolveEmployeeIdForStaff(tx, ctx.staff, ctx.organizationId)) ?? '__unlinked__';

        const dealWhere = {
          organizationId: ctx.organizationId,
          ...(viewerEmployeeId ? { ownerEmployeeId: viewerEmployeeId } : {}),
        };

        const dealRows = await tx.salesDeal.findMany({
          where: dealWhere,
          select: {
            stage: true,
            value: true,
            probability: true,
            currency: true,
            createdAt: true,
            closedAt: true,
            stageEnteredAt: true,
            lastActivityAt: true,
            ownerEmployeeId: true,
            owner: { select: { id: true, firstName: true, lastName: true } },
          },
        });

        const currency = dealRows[0]?.currency ?? 'KES';

        const deals: AnalyticsDeal[] = dealRows.map((d) => ({
          stage: d.stage,
          value: Number(d.value),
          probability: d.probability,
          createdAt: d.createdAt,
          closedAt: d.closedAt,
          stageEnteredAt: d.stageEnteredAt,
          lastActivityAt: d.lastActivityAt,
        }));

        // (a) Stage conversion + funnel + monthly trend from pure helpers.
        const stageConversion = stageConversionRates(deals);
        const funnel = funnelByStage(deals).map((f) => ({
          stage: f.stage,
          count: f.count,
          value: Math.round(f.value * 100) / 100,
        }));
        const trend = monthlyTrend(deals, months, now).map((p) => ({
          ...p,
          wonValue: Math.round(p.wonValue * 100) / 100,
        }));

        // (b) Deal aging distribution (open deals only).
        const agingMap = new Map<string, AgingBucket>();
        for (const b of AGING_BUCKETS) {
          agingMap.set(b.bucket, { bucket: b.bucket, label: b.label, count: 0, value: 0 });
        }
        let rottingCount = 0;
        let rottingValue = 0;
        for (const d of deals) {
          const idle = dealIdleDays(d, now);
          if (idle == null) continue; // closed deals never age
          const slot = AGING_BUCKETS.find((b) => idle >= b.min && idle <= b.max);
          if (slot) {
            const bucket = agingMap.get(slot.bucket)!;
            bucket.count += 1;
            bucket.value += d.value;
          }
          if (isDealRotting(d, now)) {
            rottingCount += 1;
            rottingValue += d.value;
          }
        }
        const dealAging = [...agingMap.values()].map((b) => ({
          ...b,
          value: Math.round(b.value * 100) / 100,
        }));

        // (c) Per-rep performance from deals grouped by owner.
        type RepAgg = {
          employeeId: string;
          employeeName: string;
          deals: AnalyticsDeal[];
          closedValue: number;
          openValue: number;
          openDeals: number;
        };
        const repMap = new Map<string, RepAgg>();
        for (const d of dealRows) {
          const id = d.ownerEmployeeId;
          const name = `${d.owner?.firstName ?? ''} ${d.owner?.lastName ?? ''}`.trim() || 'Unassigned';
          let agg = repMap.get(id);
          if (!agg) {
            agg = { employeeId: id, employeeName: name, deals: [], closedValue: 0, openValue: 0, openDeals: 0 };
            repMap.set(id, agg);
          }
          const value = Number(d.value);
          agg.deals.push({
            stage: d.stage,
            value,
            probability: d.probability,
            createdAt: d.createdAt,
            closedAt: d.closedAt,
            stageEnteredAt: d.stageEnteredAt,
            lastActivityAt: d.lastActivityAt,
          });
          if (d.stage === 'won') agg.closedValue += value;
          if (OPEN_PIPELINE_STAGES.includes(d.stage as SalesDealStage)) {
            agg.openValue += value;
            agg.openDeals += 1;
          }
        }
        const repPerformance = [...repMap.values()]
          .map((agg) => ({
            employeeId: agg.employeeId,
            employeeName: agg.employeeName,
            dealsWon: agg.deals.filter((x) => x.stage === 'won').length,
            dealsLost: agg.deals.filter((x) => x.stage === 'lost').length,
            openDeals: agg.openDeals,
            winRatePct: computeWinRate(agg.deals),
            avgDealSize: avgWonDealValue(agg.deals),
            closedValue: Math.round(agg.closedValue * 100) / 100,
            openValue: Math.round(agg.openValue * 100) / 100,
          }))
          .sort((a, b) => b.closedValue - a.closedValue);

        // (d) Activity leaderboard — count SalesDealActivity per actor.
        const activityGroups = await tx.salesDealActivity.groupBy({
          by: ['actorEmployeeId'],
          where: {
            organizationId: ctx.organizationId,
            ...(viewerEmployeeId ? { actorEmployeeId: viewerEmployeeId } : {}),
          },
          _count: { _all: true },
        });

        const actorIds = activityGroups.map((g) => g.actorEmployeeId);
        const actors = actorIds.length
          ? await tx.employee.findMany({
              where: { organizationId: ctx.organizationId, id: { in: actorIds } },
              select: { id: true, firstName: true, lastName: true },
            })
          : [];
        const actorName = new Map(
          actors.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim() || 'Unknown']),
        );
        const wonByRep = new Map(repPerformance.map((r) => [r.employeeId, r]));

        const activityLeaderboard = activityGroups
          .map((g) => {
            const rep = wonByRep.get(g.actorEmployeeId);
            return {
              employeeId: g.actorEmployeeId,
              employeeName: actorName.get(g.actorEmployeeId) ?? rep?.employeeName ?? 'Unknown',
              activities: g._count._all,
              dealsWon: rep?.dealsWon ?? 0,
              closedValue: rep?.closedValue ?? 0,
            };
          })
          .sort((a, b) => b.activities - a.activities);

        return {
          periodStart: periodStart.toISOString().slice(0, 10),
          periodEnd: periodEnd.toISOString().slice(0, 10),
          currency,
          months,
          scope: seeAll ? ('team' as const) : ('self' as const),
          totalDeals: deals.length,
          stageConversion,
          funnel,
          monthlyTrend: trend,
          dealAging,
          rotting: {
            count: rottingCount,
            value: Math.round(rottingValue * 100) / 100,
          },
          repPerformance,
          activityLeaderboard,
        };
      });

      return NextResponse.json({ analytics });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/analytics',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load sales analytics.' }, { status: 500 });
    }
  });
}
