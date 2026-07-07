import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { syncRepPeriodMetric } from '@/lib/sales/metrics-sync';
import { SALES_DEAL_STAGES } from '@/lib/sales/schema';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    try {
      const stage = request.nextUrl.searchParams.get('stage')?.trim() || undefined;
      const ownerEmployeeId = request.nextUrl.searchParams.get('ownerEmployeeId')?.trim() || undefined;

      const deals = await ctx.run((tx) =>
        tx.salesDeal.findMany({
          where: {
            ...ctx.where(),
            ...(stage ? { stage: stage as never } : {}),
            ...(ownerEmployeeId ? { ownerEmployeeId } : {}),
          },
          include: {
            owner: { select: { id: true, firstName: true, lastName: true } },
            accountsClient: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 200,
        }),
      );

      return NextResponse.json({
        deals: deals.map((d) => ({
          id: d.id,
          name: d.name,
          stage: d.stage,
          value: Number(d.value),
          currency: d.currency,
          ownerEmployeeId: d.ownerEmployeeId,
          owner: d.owner
            ? { id: d.owner.id, name: `${d.owner.firstName} ${d.owner.lastName}`.trim() }
            : null,
          expectedCloseDate: d.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
          closedAt: d.closedAt?.toISOString() ?? null,
          accountsInvoiceId: d.accountsInvoiceId,
          accountsClient: d.accountsClient,
          notes: d.notes,
          createdAt: d.createdAt.toISOString(),
        })),
      });
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
    const stage = typeof body.stage === 'string' ? body.stage.trim() : 'lead';

    if (!name || !ownerEmployeeId) {
      return NextResponse.json({ error: 'name and ownerEmployeeId are required.' }, { status: 400 });
    }
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: 'value must be a positive number.' }, { status: 400 });
    }
    if (!SALES_DEAL_STAGES.includes(stage as never)) {
      return NextResponse.json({ error: 'Invalid stage.' }, { status: 400 });
    }

    try {
      const deal = await ctx.run(async (tx) => {
        const created = await tx.salesDeal.create({
          data: {
            organizationId: ctx.organizationId,
            name,
            ownerEmployeeId,
            value,
            stage: stage as never,
            currency: typeof body.currency === 'string' ? body.currency.trim() : 'KES',
            expectedCloseDate:
              typeof body.expectedCloseDate === 'string' && body.expectedCloseDate
                ? new Date(`${body.expectedCloseDate}T00:00:00.000Z`)
                : null,
            accountsInvoiceId:
              typeof body.accountsInvoiceId === 'string' ? body.accountsInvoiceId.trim() || null : null,
            accountsClientId:
              typeof body.accountsClientId === 'string' ? body.accountsClientId.trim() || null : null,
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
            closedAt: stage === 'won' || stage === 'lost' ? new Date() : null,
          },
        });

        if (stage === 'won') {
          const periodStart = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1);
          const periodEnd = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0);
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

      return NextResponse.json({ deal: { id: deal.id, stage: deal.stage } }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/deals',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create deal.' }, { status: 500 });
    }
  });
}
