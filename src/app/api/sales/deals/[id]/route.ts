import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { requireAccessibleDeal, SalesAccessError } from '@/lib/sales/access';
import {
  currentMonthPeriod,
  dealInclude,
  mapDealToJson,
} from '@/lib/sales/api-helpers';
import { createCloseOpsDrafts } from '@/lib/sales/close-ops';
import {
  evaluateFleetCapacityForDeal,
  evaluateSalesLegalGate,
} from '@/lib/sales/cross-module-gates';
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
      const payload = await ctx.run(async (tx) => {
        await requireAccessibleDeal(tx, ctx.staff, ctx.organizationId, id);
        const deal = await tx.salesDeal.findFirst({
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
        });
        if (!deal) return null;

        const [legal, fleet] = await Promise.all([
          evaluateSalesLegalGate(tx, {
            organizationId: ctx.organizationId,
            accountsClientId: deal.accountsClientId,
          }),
          evaluateFleetCapacityForDeal(tx, {
            organizationId: ctx.organizationId,
            cargoWeightKg: deal.cargoWeightKg,
          }),
        ]);

        return { deal, legal, fleet };
      });

      if (!payload) {
        return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
      }

      const { deal, legal, fleet } = payload;

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
          closeWarnings: {
            legal: legal.warnings,
            fleet: fleet.warnings,
          },
        },
      });
    } catch (error) {
      if (error instanceof SalesAccessError) {
        return NextResponse.json({ error: error.message }, { status: error.code === 'FORBIDDEN' ? 403 : 404 });
      }
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

    const acknowledgeWarnings = body.acknowledgeWarnings === true;

    try {
      const result = await ctx.run(async (tx) => {
        let existing;
        try {
          existing = await requireAccessibleDeal(tx, ctx.staff, ctx.organizationId, id);
        } catch (e) {
          if (e instanceof SalesAccessError) {
            return { accessError: e } as const;
          }
          throw e;
        }

        let updated = existing;
        const warnings: string[] = [];

        if (stage === 'won' && existing.stage !== 'won') {
          const [legal, fleet] = await Promise.all([
            evaluateSalesLegalGate(tx, {
              organizationId: ctx.organizationId,
              accountsClientId: existing.accountsClientId,
            }),
            evaluateFleetCapacityForDeal(tx, {
              organizationId: ctx.organizationId,
              cargoWeightKg:
                body.cargoWeightKg != null
                  ? Number(body.cargoWeightKg)
                  : existing.cargoWeightKg,
            }),
          ]);
          warnings.push(...legal.warnings, ...fleet.warnings);
          if (warnings.length > 0 && !acknowledgeWarnings) {
            return { blocked: true as const, warnings, deal: existing };
          }
        }

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
        if (body.cargoWeightKg !== undefined) {
          patchData.cargoWeightKg =
            body.cargoWeightKg == null || body.cargoWeightKg === ''
              ? null
              : Math.max(0, Math.round(Number(body.cargoWeightKg)));
        }

        if (Object.keys(patchData).length > 0) {
          updated = await tx.salesDeal.update({
            where: { id },
            data: patchData,
          });
        }

        const finalStage = updated.stage;
        let closeOps = null as Awaited<ReturnType<typeof createCloseOpsDrafts>> | null;
        if (finalStage === 'won') {
          const { periodStart, periodEnd } = currentMonthPeriod();
          await syncRepPeriodMetric(tx, {
            organizationId: ctx.organizationId,
            employeeId: updated.ownerEmployeeId,
            periodStart,
            periodEnd,
            currency: updated.currency,
          });
          if (stage === 'won' && existing.stage !== 'won') {
            closeOps = await createCloseOpsDrafts(tx, {
              organizationId: ctx.organizationId,
              deal: updated,
              staffUserId: ctx.staff.id,
              options: {
                createProject: body.createProject !== false,
                createFleetOrder: body.createFleetOrder === true,
                createPurchaseRequest: body.createPurchaseRequest === true,
                pickupLocation: typeof body.pickupLocation === 'string' ? body.pickupLocation : null,
                deliveryLocation: typeof body.deliveryLocation === 'string' ? body.deliveryLocation : null,
              },
            });
          }
        }

        const deal = await tx.salesDeal.findFirst({
          where: { id },
          include: dealInclude,
        });

        return { blocked: false as const, warnings, deal, closeOps };
      });

      if (!result) {
        return NextResponse.json({ error: 'Deal not found.' }, { status: 404 });
      }
      if ('accessError' in result && result.accessError) {
        const ae = result.accessError;
        return NextResponse.json({ error: ae.message }, { status: ae.code === 'FORBIDDEN' ? 403 : 404 });
      }

      if (result.blocked) {
        return NextResponse.json(
          {
            error: 'Close warnings require acknowledgement.',
            warnings: result.warnings,
            requireAcknowledge: true,
          },
          { status: 409 },
        );
      }

      return NextResponse.json({
        deal: mapDealToJson(result.deal!),
        warnings: result.warnings,
        closeOps: 'closeOps' in result ? result.closeOps : null,
      });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/sales/deals/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update deal.' }, { status: 500 });
    }
  });
}
