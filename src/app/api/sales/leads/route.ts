import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { resolveEmployeeIdForStaff } from '@/lib/sales/api-helpers';
import { canViewAllSalesDeals } from '@/lib/staff-permissions';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const LEAD_STATUSES = ['new', 'qualified', 'disqualified', 'converted'] as const;

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

    try {
      const leads = await ctx.run(async (tx) => {
        const where: Record<string, unknown> = {
          organizationId: ctx.organizationId,
          ...(status ? { status: status as never } : {}),
        };

        if (!canViewAllSalesDeals(ctx.staff.role, ctx.staff.staffUserType)) {
          const linked = await resolveEmployeeIdForStaff(tx, ctx.staff, ctx.organizationId);
          where.ownerEmployeeId = linked ?? '__unlinked__';
        }

        return tx.salesLead.findMany({
          where,
          include: {
            owner: { select: { id: true, firstName: true, lastName: true } },
            convertedDeal: { select: { id: true, name: true, stage: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 200,
        });
      });

      return NextResponse.json({
        leads: leads.map((l) => ({
          id: l.id,
          name: l.name,
          company: l.company,
          email: l.email,
          phone: l.phone,
          source: l.source,
          status: l.status,
          notes: l.notes,
          ownerEmployeeId: l.ownerEmployeeId,
          owner: l.owner
            ? { id: l.owner.id, name: `${l.owner.firstName} ${l.owner.lastName}`.trim() }
            : null,
          convertedDealId: l.convertedDealId,
          convertedDeal: l.convertedDeal,
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/leads',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load leads.' }, { status: 500 });
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
    if (!name) {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 });
    }

    try {
      const lead = await ctx.run(async (tx) => {
        let ownerEmployeeId =
          typeof body.ownerEmployeeId === 'string' ? body.ownerEmployeeId.trim() || null : null;
        if (!ownerEmployeeId) {
          ownerEmployeeId = await resolveEmployeeIdForStaff(tx, ctx.staff, ctx.organizationId);
        }

        return tx.salesLead.create({
          data: {
            organizationId: ctx.organizationId,
            name,
            company: typeof body.company === 'string' ? body.company.trim() || null : null,
            email: typeof body.email === 'string' ? body.email.trim() || null : null,
            phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
            source: typeof body.source === 'string' ? body.source.trim() || null : null,
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
            ownerEmployeeId,
            status:
              typeof body.status === 'string' && LEAD_STATUSES.includes(body.status as never)
                ? (body.status as never)
                : 'new',
          },
          include: {
            owner: { select: { id: true, firstName: true, lastName: true } },
          },
        });
      });

      return NextResponse.json(
        {
          lead: {
            id: lead.id,
            name: lead.name,
            company: lead.company,
            status: lead.status,
            ownerEmployeeId: lead.ownerEmployeeId,
            owner: lead.owner
              ? {
                  id: lead.owner.id,
                  name: `${lead.owner.firstName} ${lead.owner.lastName}`.trim(),
                }
              : null,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/leads',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create lead.' }, { status: 500 });
    }
  });
}
