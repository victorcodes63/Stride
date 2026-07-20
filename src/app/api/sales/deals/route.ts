import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { applySalesDealOwnerScope, resolveOwnerForCreate, SalesAccessError } from '@/lib/sales/access';
import {
  currentMonthPeriod,
  dealInclude,
  mapDealToJson,
} from '@/lib/sales/api-helpers';
import { syncRepPeriodMetric } from '@/lib/sales/metrics-sync';
import {
  defaultForecastForStage,
  defaultProbabilityForStage,
  SALES_DEAL_STAGES,
  SALES_FORECAST_CATEGORIES,
  type SalesDealStage,
} from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    try {
      const params = request.nextUrl.searchParams;
      const stage = params.get('stage')?.trim() || undefined;
      const forecastCategory = params.get('forecastCategory')?.trim() || undefined;
      const closeFrom = params.get('closeFrom')?.trim() || undefined;
      const closeTo = params.get('closeTo')?.trim() || undefined;
      const q = params.get('q')?.trim() || undefined;
      const sort = params.get('sort')?.trim() || undefined;
      const owner =
        params.get('owner')?.trim() ||
        params.get('ownerEmployeeId')?.trim() ||
        undefined;

      const orderBy: Prisma.SalesDealOrderByWithRelationInput | Prisma.SalesDealOrderByWithRelationInput[] =
        sort === 'value'
          ? { value: 'desc' }
          : sort === 'close'
            ? [{ expectedCloseDate: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }]
            : sort === 'idle'
              ? [
                  { lastActivityAt: { sort: 'asc', nulls: 'first' } },
                  { stageEnteredAt: { sort: 'asc', nulls: 'first' } },
                ]
              : { updatedAt: 'desc' };

      const deals = await ctx.run(async (tx) => {
        const baseWhere = ctx.where({
          ...(stage ? { stage: stage as never } : {}),
          ...(forecastCategory ? { forecastCategory: forecastCategory as never } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' as const } },
                  { accountsClient: { is: { name: { contains: q, mode: 'insensitive' as const } } } },
                  { primaryContact: { is: { name: { contains: q, mode: 'insensitive' as const } } } },
                ],
              }
            : {}),
          ...(closeFrom || closeTo
            ? {
                expectedCloseDate: {
                  ...(closeFrom ? { gte: new Date(`${closeFrom}T00:00:00.000Z`) } : {}),
                  ...(closeTo ? { lte: new Date(`${closeTo}T00:00:00.000Z`) } : {}),
                },
              }
            : {}),
        });

        const where = await applySalesDealOwnerScope(
          tx,
          ctx.staff,
          ctx.organizationId,
          baseWhere,
          owner,
        );

        return tx.salesDeal.findMany({
          where,
          include: dealInclude,
          orderBy,
          take: 200,
        });
      });

      return NextResponse.json({ deals: deals.map(mapDealToJson) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/deals',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load deals.' }, { status: 500 });
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

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const ownerEmployeeId = typeof body.ownerEmployeeId === 'string' ? body.ownerEmployeeId.trim() : '';
    const value = typeof body.value === 'number' ? body.value : Number(body.value);
    const stage = (typeof body.stage === 'string' ? body.stage.trim() : 'lead') as SalesDealStage;

    if (!name || !ownerEmployeeId) {
      return NextResponse.json({ error: 'name and ownerEmployeeId are required.' }, { status: 400 });
    }
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: 'value must be a positive number.' }, { status: 400 });
    }
    if (!SALES_DEAL_STAGES.includes(stage)) {
      return NextResponse.json({ error: 'Invalid stage.' }, { status: 400 });
    }

    const forecastCategory =
      typeof body.forecastCategory === 'string' &&
      SALES_FORECAST_CATEGORIES.includes(body.forecastCategory as never)
        ? (body.forecastCategory as never)
        : defaultForecastForStage(stage);

    const probability =
      body.probability != null && Number.isFinite(Number(body.probability))
        ? Math.min(100, Math.max(0, Math.round(Number(body.probability))))
        : defaultProbabilityForStage(stage);

    const cargoWeightKg =
      body.cargoWeightKg != null && Number.isFinite(Number(body.cargoWeightKg))
        ? Math.max(0, Math.round(Number(body.cargoWeightKg)))
        : null;

    try {
      const deal = await ctx.run(async (tx) => {
        const resolvedOwner = await resolveOwnerForCreate(
          tx,
          ctx.staff,
          ctx.organizationId,
          ownerEmployeeId,
        );
        const created = await tx.salesDeal.create({
          data: {
            organizationId: ctx.organizationId,
            name,
            ownerEmployeeId: resolvedOwner,
            value,
            stage,
            probability,
            forecastCategory,
            currency: typeof body.currency === 'string' ? body.currency.trim() : 'KES',
            expectedCloseDate:
              typeof body.expectedCloseDate === 'string' && body.expectedCloseDate
                ? new Date(`${body.expectedCloseDate}T00:00:00.000Z`)
                : null,
            primaryContactId:
              typeof body.primaryContactId === 'string' ? body.primaryContactId.trim() || null : null,
            accountsClientId:
              typeof body.accountsClientId === 'string' ? body.accountsClientId.trim() || null : null,
            source: typeof body.source === 'string' ? body.source.trim() || null : null,
            nextStep: typeof body.nextStep === 'string' ? body.nextStep.trim() || null : null,
            nextStepDue:
              typeof body.nextStepDue === 'string' && body.nextStepDue
                ? new Date(`${body.nextStepDue}T00:00:00.000Z`)
                : null,
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
            cargoWeightKg,
            closedAt: stage === 'won' || stage === 'lost' ? new Date() : null,
            stageEnteredAt: new Date(),
            lastActivityAt: new Date(),
          },
          include: dealInclude,
        });

        await tx.salesDealStageHistory.create({
          data: {
            organizationId: ctx.organizationId,
            dealId: created.id,
            fromStage: null,
            toStage: stage,
            changedByUserId: ctx.staff.id,
          },
        });

        if (stage === 'won') {
          const { periodStart, periodEnd } = currentMonthPeriod();
          await syncRepPeriodMetric(tx, {
            organizationId: ctx.organizationId,
            employeeId: ownerEmployeeId,
            periodStart,
            periodEnd,
            currency: created.currency,
          });
        }

        return created;
      });

      return NextResponse.json({ deal: mapDealToJson(deal) }, { status: 201 });
    } catch (error) {
      if (error instanceof SalesAccessError) {
        return NextResponse.json({ error: error.message }, { status: error.code === 'FORBIDDEN' ? 403 : 404 });
      }
      await reportApiError({
        route: 'POST /api/sales/deals',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create deal.' }, { status: 500 });
    }
  });
}
