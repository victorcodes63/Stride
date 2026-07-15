import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { dealInclude, mapDealToJson } from '@/lib/sales/api-helpers';
import {
  defaultForecastForStage,
  defaultProbabilityForStage,
} from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const LEAD_STATUSES = ['new', 'qualified', 'disqualified', 'converted'] as const;

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

    const action = typeof body.action === 'string' ? body.action.trim() : '';

    try {
      if (action === 'convert') {
        const result = await ctx.run(async (tx) => {
          const lead = await tx.salesLead.findFirst({
            where: { id, organizationId: ctx.organizationId },
          });
          if (!lead) return null;
          if (lead.status === 'converted' && lead.convertedDealId) {
            const existing = await tx.salesDeal.findFirst({
              where: { id: lead.convertedDealId },
              include: dealInclude,
            });
            return { lead, deal: existing };
          }

          const value =
            body.value != null && Number.isFinite(Number(body.value))
              ? Number(body.value)
              : 100_000;
          const ownerEmployeeId =
            (typeof body.ownerEmployeeId === 'string' && body.ownerEmployeeId.trim()) ||
            lead.ownerEmployeeId;
          if (!ownerEmployeeId) {
            throw Object.assign(new Error('OWNER_REQUIRED'), { code: 'OWNER_REQUIRED' });
          }

          const deal = await tx.salesDeal.create({
            data: {
              organizationId: ctx.organizationId,
              name:
                typeof body.dealName === 'string' && body.dealName.trim()
                  ? body.dealName.trim()
                  : `${lead.company || lead.name} — opportunity`,
              ownerEmployeeId,
              value,
              stage: 'qualified',
              probability: defaultProbabilityForStage('qualified'),
              forecastCategory: defaultForecastForStage('qualified'),
              source: lead.source ?? 'Lead conversion',
              notes: lead.notes,
              accountsClientId:
                typeof body.accountsClientId === 'string'
                  ? body.accountsClientId.trim() || null
                  : null,
            },
            include: dealInclude,
          });

          await tx.salesDealStageHistory.create({
            data: {
              organizationId: ctx.organizationId,
              dealId: deal.id,
              fromStage: null,
              toStage: 'qualified',
              changedByUserId: ctx.staff.id,
            },
          });

          const updatedLead = await tx.salesLead.update({
            where: { id },
            data: {
              status: 'converted',
              convertedDealId: deal.id,
            },
          });

          return { lead: updatedLead, deal };
        });

        if (!result) {
          return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
        }

        return NextResponse.json({
          lead: {
            id: result.lead.id,
            status: result.lead.status,
            convertedDealId: result.lead.convertedDealId,
          },
          deal: result.deal ? mapDealToJson(result.deal) : null,
        });
      }

      const updated = await ctx.run(async (tx) => {
        const existing = await tx.salesLead.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });
        if (!existing) return null;

        return tx.salesLead.update({
          where: { id },
          data: {
            ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
            ...(typeof body.company === 'string'
              ? { company: body.company.trim() || null }
              : {}),
            ...(typeof body.email === 'string' ? { email: body.email.trim() || null } : {}),
            ...(typeof body.phone === 'string' ? { phone: body.phone.trim() || null } : {}),
            ...(typeof body.source === 'string' ? { source: body.source.trim() || null } : {}),
            ...(typeof body.notes === 'string' ? { notes: body.notes.trim() || null } : {}),
            ...(typeof body.ownerEmployeeId === 'string'
              ? { ownerEmployeeId: body.ownerEmployeeId.trim() || null }
              : {}),
            ...(typeof body.status === 'string' && LEAD_STATUSES.includes(body.status as never)
              ? { status: body.status as never }
              : {}),
          },
        });
      });

      if (!updated) {
        return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
      }

      return NextResponse.json({
        lead: { id: updated.id, status: updated.status, name: updated.name },
      });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'OWNER_REQUIRED') {
        return NextResponse.json(
          { error: 'ownerEmployeeId is required to convert this lead.' },
          { status: 400 },
        );
      }
      await reportApiError({
        route: 'PATCH /api/sales/leads/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update lead.' }, { status: 500 });
    }
  });
}
