import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessSacco, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildDividendAllocations } from '@/lib/sacco/dividends';
import { serializeDividendRun } from '@/lib/sacco/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessSacco(ctx.staff)) {
      return forbiddenResponse('SACCO access is restricted to finance and admin users.');
    }

    try {
      const runs = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return tx.saccoDividendRun.findMany({
          where: { ...ctx.where(), outsourcingClientId: clientId },
          include: { _count: { select: { lines: true } } },
          orderBy: { periodEnd: 'desc' },
          take: 50,
        });
      });
      return NextResponse.json({ runs: runs.map(serializeDividendRun) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sacco/dividends',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load dividend runs.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessSacco(ctx.staff)) {
      return forbiddenResponse('SACCO access is restricted to finance and admin users.');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const periodStart = typeof body.periodStart === 'string' ? body.periodStart.trim() : '';
    const periodEnd = typeof body.periodEnd === 'string' ? body.periodEnd.trim() : '';
    const ratePercent = typeof body.ratePercent === 'number' ? body.ratePercent : Number(body.ratePercent);

    if (!label || !periodStart || !periodEnd || !Number.isFinite(ratePercent) || ratePercent <= 0) {
      return NextResponse.json(
        { error: 'label, periodStart, periodEnd, and positive ratePercent are required.' },
        { status: 400 },
      );
    }

    try {
      const run = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        const allocations = await buildDividendAllocations(tx, clientId, ratePercent);
        const totalAmount = allocations.reduce((sum, row) => sum + row.dividendAmount, 0);

        return tx.saccoDividendRun.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            label,
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            ratePercent,
            totalAmount,
            createdByUserId: ctx.staff.id,
            lines: {
              create: allocations.map((row) => ({
                organizationId: ctx.organizationId,
                memberId: row.memberId,
                sharesBalance: row.sharesBalance,
                dividendAmount: row.dividendAmount,
              })),
            },
          },
          include: { _count: { select: { lines: true } } },
        });
      });

      return NextResponse.json({ run: serializeDividendRun(run) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sacco/dividends',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create dividend run.' }, { status: 500 });
    }
  });
}
