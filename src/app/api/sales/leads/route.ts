import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { resolveEmployeeIdForStaff } from '@/lib/sales/api-helpers';
import { scoreLead } from '@/lib/sales/lead-scoring';
import { SALES_LEAD_RATINGS } from '@/lib/sales/schema';
import { canViewAllSalesDeals } from '@/lib/staff-permissions';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const LEAD_STATUSES = ['new', 'qualified', 'disqualified', 'converted'] as const;
const SORTS = ['score', 'value', 'recent'] as const;

/** Build the Prisma orderBy for the requested sort key. */
function orderByForSort(sort: string) {
  switch (sort) {
    case 'value':
      return [{ estimatedValue: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }];
    case 'recent':
      return [{ lastActivityAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }];
    case 'score':
    default:
      return [{ score: 'desc' }, { updatedAt: 'desc' }];
  }
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const params = request.nextUrl.searchParams;
    const status = params.get('status')?.trim() || undefined;
    const rating = params.get('rating')?.trim() || undefined;
    const source = params.get('source')?.trim() || undefined;
    const q = params.get('q')?.trim() || undefined;
    const sortParam = params.get('sort')?.trim() || 'score';
    const sort = SORTS.includes(sortParam as never) ? sortParam : 'score';

    try {
      const leads = await ctx.run(async (tx) => {
        const where: Record<string, unknown> = {
          organizationId: ctx.organizationId,
          ...(status && LEAD_STATUSES.includes(status as never) ? { status: status as never } : {}),
          ...(rating && SALES_LEAD_RATINGS.includes(rating as never)
            ? { rating: rating as never }
            : {}),
          ...(source ? { source: { equals: source, mode: 'insensitive' } } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { company: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
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
          orderBy: orderByForSort(sort) as never,
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
          score: l.score,
          rating: l.rating,
          estimatedValue: l.estimatedValue != null ? Number(l.estimatedValue) : null,
          lastActivityAt: l.lastActivityAt?.toISOString() ?? null,
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

    const company = typeof body.company === 'string' ? body.company.trim() || null : null;
    const email = typeof body.email === 'string' ? body.email.trim() || null : null;
    const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
    const source = typeof body.source === 'string' ? body.source.trim() || null : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    const status =
      typeof body.status === 'string' && LEAD_STATUSES.includes(body.status as never)
        ? (body.status as (typeof LEAD_STATUSES)[number])
        : 'new';

    const rawValue = Number(body.estimatedValue);
    const estimatedValue =
      body.estimatedValue != null && Number.isFinite(rawValue) && rawValue >= 0 ? rawValue : null;

    try {
      const now = new Date();
      const { score, rating } = scoreLead(
        { email, phone, company, source, status, estimatedValue, lastActivityAt: now, createdAt: now },
        now,
      );

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
            company,
            email,
            phone,
            source,
            notes,
            estimatedValue,
            ownerEmployeeId,
            status,
            score,
            rating,
            lastActivityAt: now,
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
            email: lead.email,
            phone: lead.phone,
            source: lead.source,
            status: lead.status,
            score: lead.score,
            rating: lead.rating,
            estimatedValue: lead.estimatedValue != null ? Number(lead.estimatedValue) : null,
            lastActivityAt: lead.lastActivityAt?.toISOString() ?? null,
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
