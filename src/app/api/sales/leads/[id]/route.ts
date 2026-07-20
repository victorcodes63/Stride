import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { dealInclude, mapDealToJson, resolveEmployeeIdForStaff } from '@/lib/sales/api-helpers';
import { scoreLead } from '@/lib/sales/lead-scoring';
import {
  defaultForecastForStage,
  defaultProbabilityForStage,
} from '@/lib/sales/schema';
import { canViewAllSalesDeals } from '@/lib/staff-permissions';
import { withTenant } from '@/lib/tenant-api';
import type { StaffUser } from '@/lib/staff-api-auth';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const LEAD_STATUSES = ['new', 'qualified', 'disqualified', 'converted'] as const;

/**
 * Build a where clause scoped to the org, and — for reps who can't see all
 * deals — restricted to leads they own. Keeps owner-scoping consistent with GET.
 */
async function ownerScopedWhere(
  tx: Prisma.TransactionClient,
  staff: StaffUser,
  organizationId: string,
  id: string,
): Promise<Record<string, unknown>> {
  const where: Record<string, unknown> = { id, organizationId };
  if (!canViewAllSalesDeals(staff.role, staff.staffUserType)) {
    const linked = await resolveEmployeeIdForStaff(tx, staff, organizationId);
    where.ownerEmployeeId = linked ?? '__unlinked__';
  }
  return where;
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

    const action = typeof body.action === 'string' ? body.action.trim() : '';

    try {
      if (action === 'convert') {
        const result = await ctx.run(async (tx) => {
          const where = await ownerScopedWhere(tx, ctx.staff, ctx.organizationId, id);
          const lead = await tx.salesLead.findFirst({ where });
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
              : lead.estimatedValue != null && Number(lead.estimatedValue) > 0
                ? Number(lead.estimatedValue)
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

          const now = new Date();
          const { score, rating } = scoreLead(
            {
              email: lead.email,
              phone: lead.phone,
              company: lead.company,
              source: lead.source,
              status: 'converted',
              estimatedValue: lead.estimatedValue != null ? Number(lead.estimatedValue) : null,
              lastActivityAt: now,
              createdAt: lead.createdAt,
            },
            now,
          );

          const updatedLead = await tx.salesLead.update({
            where: { id },
            data: {
              status: 'converted',
              convertedDealId: deal.id,
              score,
              rating,
              lastActivityAt: now,
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
        const where = await ownerScopedWhere(tx, ctx.staff, ctx.organizationId, id);
        const existing = await tx.salesLead.findFirst({ where });
        if (!existing) return null;

        // Merge incoming fields over the current record so the score reflects
        // the full lead, not just the fields that changed in this request.
        const next = {
          name: typeof body.name === 'string' ? body.name.trim() : existing.name,
          company:
            typeof body.company === 'string' ? body.company.trim() || null : existing.company,
          email: typeof body.email === 'string' ? body.email.trim() || null : existing.email,
          phone: typeof body.phone === 'string' ? body.phone.trim() || null : existing.phone,
          source: typeof body.source === 'string' ? body.source.trim() || null : existing.source,
          notes: typeof body.notes === 'string' ? body.notes.trim() || null : existing.notes,
          ownerEmployeeId:
            typeof body.ownerEmployeeId === 'string'
              ? body.ownerEmployeeId.trim() || null
              : existing.ownerEmployeeId,
          status:
            typeof body.status === 'string' && LEAD_STATUSES.includes(body.status as never)
              ? (body.status as (typeof LEAD_STATUSES)[number])
              : (existing.status as (typeof LEAD_STATUSES)[number]),
          estimatedValue:
            'estimatedValue' in body
              ? body.estimatedValue != null &&
                Number.isFinite(Number(body.estimatedValue)) &&
                Number(body.estimatedValue) >= 0
                ? Number(body.estimatedValue)
                : null
              : existing.estimatedValue != null
                ? Number(existing.estimatedValue)
                : null,
        };

        const now = new Date();
        const { score, rating } = scoreLead(
          {
            email: next.email,
            phone: next.phone,
            company: next.company,
            source: next.source,
            status: next.status,
            estimatedValue: next.estimatedValue,
            lastActivityAt: now,
            createdAt: existing.createdAt,
          },
          now,
        );

        return tx.salesLead.update({
          where: { id },
          data: {
            name: next.name,
            company: next.company,
            email: next.email,
            phone: next.phone,
            source: next.source,
            notes: next.notes,
            ownerEmployeeId: next.ownerEmployeeId,
            status: next.status as never,
            estimatedValue: next.estimatedValue,
            score,
            rating,
            lastActivityAt: now,
          },
        });
      });

      if (!updated) {
        return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
      }

      return NextResponse.json({
        lead: {
          id: updated.id,
          status: updated.status,
          name: updated.name,
          score: updated.score,
          rating: updated.rating,
          estimatedValue: updated.estimatedValue != null ? Number(updated.estimatedValue) : null,
          lastActivityAt: updated.lastActivityAt?.toISOString() ?? null,
        },
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;

    try {
      const deleted = await ctx.run(async (tx) => {
        const where = await ownerScopedWhere(tx, ctx.staff, ctx.organizationId, id);
        const existing = await tx.salesLead.findFirst({ where });
        if (!existing) return null;
        await tx.salesLead.delete({ where: { id } });
        return existing;
      });

      if (!deleted) {
        return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
      }

      return NextResponse.json({ ok: true, id });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/sales/leads/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete lead.' }, { status: 500 });
    }
  });
}
