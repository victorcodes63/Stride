import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import {
  currentMonthPeriod,
  dealInclude,
  mapDealToJson,
} from '@/lib/sales/api-helpers';
import { moveDealStage } from '@/lib/sales/deal-stage';
import { syncRepPeriodMetric } from '@/lib/sales/metrics-sync';
import {
  SALES_DEAL_STAGES,
  SALES_FORECAST_CATEGORIES,
  type SalesDealStage,
} from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;

    try {
      const deal = await ctx.run((tx) =>
        tx.salesDeal.findFirst({
          where: { id, ...ctx.where() },
          include: {
            ...dealInclude,
            activities: {
              orderBy: { createdAt: 'desc' },
              take: 100,
              include: {
                actor: { select: { id: true, firstName: true, lastName: true } },
                contact: { select: { id: true, name: true } },
              },
            },
            stageHistory: {
              orderBy: { changedAt: 'desc' },
              take: 100,
              include: {
                changedBy: { select: { id: true, name: true } },
              },
            },
          },
        }),
      );

      if (!deal) {
        return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
      }

      return NextResponse.json({
        deal: {
          ...mapDealToJson(deal),
          activities: deal.activities.map((a) => ({
            id: a.id,
            type: a.type,
            subject: a.subject,
            body: a.body,
            outcome: a.outcome,
            actorEmployeeId: a.actorEmployeeId,
            actor: a.actor
              ? { id: a.actor.id, name: `${a.actor.firstName} ${a.actor.lastName}`.trim() }
              : null,
            contactId: a.contactId,
            contact: a.contact,
            createdAt: a.createdAt.toISOString(),
          })),
          stageHistory: deal.stageHistory.map((h) => ({
            id: h.id,
            fromStage: h.fromStage,
            toStage: h.toStage,
            changedAt: h.changedAt.toISOString(),
            changedByUserId: h.changedByUserId,
            changedBy: h.changedBy,
          })),
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/deals/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load deal.' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const stage =
      typeof body.stage === 'string' ? (body.stage.trim() as SalesDealStage) : undefined;
    if (stage && !SALES_DEAL_STAGES.includes(stage)) {
      return NextResponse.json({ error: 'Invalid stage.' }, { status: 400 });
    }

    try {
      const deal = await ctx.run(async (tx) => {
        const existing = await tx.salesDeal.findFirst({ where: { id, ...ctx.where() } });
        if (!existing) return null;

        let updated = existing;

        if (stage && stage !== existing.stage) {
          const moved = await moveDealStage(tx, {
            organizationId: ctx.organizationId,
            dealId: id,
            toStage: stage,
            changedByUserId: ctx.staff.id,
            probability:
              body.probability != null && Number.isFinite(Number(body.probability))
                ? Number(body.probability)
                : undefined,
            lostReason: typeof body.lostReason === 'string' ? body.lostReason.trim() || null : undefined,
            competitor: typeof body.competitor === 'string' ? body.competitor.trim() || null : undefined,
          });
          if (moved) updated = moved;
        }

        const patchData: Record<string, unknown> = {};

        if (body.value != null && Number.isFinite(Number(body.value))) {
          patchData.value = Number(body.value);
        }
        if (typeof body.nextStep === 'string') {
          patchData.nextStep = body.nextStep.trim() || null;
        }
        if (typeof body.nextStepDue === 'string') {
          patchData.nextStepDue = body.nextStepDue
            ? new Date(`${body.nextStepDue}T00:00:00.000Z`)
            : null;
        }
        if (
          typeof body.forecastCategory === 'string' &&
          SALES_FORECAST_CATEGORIES.includes(body.forecastCategory as never)
        ) {
          patchData.forecastCategory = body.forecastCategory;
        }
        if (body.probability != null && Number.isFinite(Number(body.probability)) && !stage) {
          patchData.probability = Math.min(100, Math.max(0, Math.round(Number(body.probability))));
        }
        if (typeof body.primaryContactId === 'string') {
          patchData.primaryContactId = body.primaryContactId.trim() || null;
        }
        if (typeof body.accountsClientId === 'string') {
          patchData.accountsClientId = body.accountsClientId.trim() || null;
        }
        if (typeof body.notes === 'string') {
          patchData.notes = body.notes.trim() || null;
        }
        if (typeof body.lostReason === 'string' && !stage) {
          patchData.lostReason = body.lostReason.trim() || null;
        }
        if (typeof body.competitor === 'string' && !stage) {
          patchData.competitor = body.competitor.trim() || null;
        }

        if (Object.keys(patchData).length > 0) {
          updated = await tx.salesDeal.update({
            where: { id },
            data: patchData,
          });
        }

        const finalStage = updated.stage;
        if (finalStage === 'won') {
          const { periodStart, periodEnd } = currentMonthPeriod();
          await syncRepPeriodMetric(tx, {
            organizationId: ctx.organizationId,
            employeeId: updated.ownerEmployeeId,
            periodStart,
            periodEnd,
            currency: updated.currency,
          });
        }

        return tx.salesDeal.findFirst({
          where: { id },
          include: dealInclude,
        });
      });

      if (!deal) {
        return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
      }

      return NextResponse.json({ deal: mapDealToJson(deal) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/sales/deals/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update deal.' }, { status: 500 });
    }
  });
}
