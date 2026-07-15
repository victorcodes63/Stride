import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { applySalesDealOwnerScope } from '@/lib/sales/access';
import { loadPeriodForecastDeals, rollupForecastFromDeals } from '@/lib/sales/forecast';
import { parsePeriodBounds } from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const periodType = request.nextUrl.searchParams.get('periodType')?.trim() || 'month';
    const anchorRaw = request.nextUrl.searchParams.get('anchor')?.trim();
    const anchor =
      anchorRaw && !Number.isNaN(Date.parse(anchorRaw))
        ? new Date(`${anchorRaw}T00:00:00.000Z`)
        : new Date();
    const { periodStart, periodEnd } = parsePeriodBounds(
      periodType === 'quarter' || periodType === 'year' ? periodType : 'month',
      anchor,
    );

    try {
      const data = await ctx.run(async (tx) => {
        const ownerScope = await applySalesDealOwnerScope(
          tx,
          ctx.staff,
          ctx.organizationId,
          { organizationId: ctx.organizationId },
        );
        const deals = await loadPeriodForecastDeals(
          tx,
          ctx.organizationId,
          periodStart,
          periodEnd,
        );
        const scoped =
          'ownerEmployeeId' in ownerScope && ownerScope.ownerEmployeeId
            ? deals.filter((d) => d.ownerEmployeeId === ownerScope.ownerEmployeeId)
            : deals;

        const rollup = rollupForecastFromDeals(scoped);
        const targets = await tx.salesTarget.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: 'approved',
            periodStart: { lte: periodEnd },
            periodEnd: { gte: periodStart },
          },
        });
        const teamTarget = targets.reduce((s, t) => s + Number(t.amount), 0);

        const snapshots = await tx.salesForecastSnapshot.findMany({
          where: {
            organizationId: ctx.organizationId,
            periodStart,
            periodEnd,
          },
          orderBy: { takenAt: 'desc' },
          take: 8,
        });

        return {
          rollup,
          teamTarget: Math.round(teamTarget * 100) / 100,
          currency: scoped[0]?.currency ?? 'KES',
          deals: scoped.slice(0, 50).map((d) => ({
            id: d.id,
            name: d.name,
            stage: d.stage,
            value: Number(d.value),
            probability: d.probability,
            forecastCategory: d.forecastCategory,
            expectedCloseDate: d.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
          })),
          snapshots: snapshots.map((s) => ({
            id: s.id,
            takenAt: s.takenAt.toISOString(),
            commitAmount: Number(s.commitAmount),
            bestCaseAmount: Number(s.bestCaseAmount),
            pipelineAmount: Number(s.pipelineAmount),
            closedAmount: Number(s.closedAmount),
            teamTarget: Number(s.teamTarget),
            notes: s.notes,
          })),
          periodStart: periodStart.toISOString().slice(0, 10),
          periodEnd: periodEnd.toISOString().slice(0, 10),
        };
      });

      return NextResponse.json(data);
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/forecast',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load forecast.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (body.action !== 'snapshot') {
      return NextResponse.json({ error: 'action must be snapshot.' }, { status: 400 });
    }

    const periodType = typeof body.periodType === 'string' ? body.periodType.trim() : 'month';
    const { periodStart, periodEnd } =
      body.periodStart && body.periodEnd
        ? {
            periodStart: new Date(`${String(body.periodStart)}T00:00:00.000Z`),
            periodEnd: new Date(`${String(body.periodEnd)}T00:00:00.000Z`),
          }
        : parsePeriodBounds(
            periodType === 'quarter' || periodType === 'year' ? periodType : 'month',
            new Date(),
          );

    try {
      const snapshot = await ctx.run(async (tx) => {
        const deals = await loadPeriodForecastDeals(
          tx,
          ctx.organizationId,
          periodStart,
          periodEnd,
        );
        const rollup = rollupForecastFromDeals(deals);
        const targets = await tx.salesTarget.findMany({
          where: {
            organizationId: ctx.organizationId,
            status: 'approved',
            periodStart: { lte: periodEnd },
            periodEnd: { gte: periodStart },
          },
        });
        const teamTarget = targets.reduce((s, t) => s + Number(t.amount), 0);

        return tx.salesForecastSnapshot.create({
          data: {
            organizationId: ctx.organizationId,
            periodStart,
            periodEnd,
            currency: deals[0]?.currency ?? 'KES',
            commitAmount: rollup.commitAmount,
            bestCaseAmount: rollup.bestCaseAmount,
            pipelineAmount: rollup.pipelineAmount,
            closedAmount: rollup.closedAmount,
            teamTarget,
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
          },
        });
      });

      return NextResponse.json(
        {
          snapshot: {
            id: snapshot.id,
            takenAt: snapshot.takenAt.toISOString(),
            commitAmount: Number(snapshot.commitAmount),
            bestCaseAmount: Number(snapshot.bestCaseAmount),
            pipelineAmount: Number(snapshot.pipelineAmount),
            closedAmount: Number(snapshot.closedAmount),
            teamTarget: Number(snapshot.teamTarget),
          },
        },
        { status: 201 },
      );
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/forecast',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to save forecast snapshot.' }, { status: 500 });
    }
  });
}
