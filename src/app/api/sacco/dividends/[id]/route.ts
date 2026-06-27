import { NextRequest, NextResponse } from 'next/server';
import { canAccessSacco, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { postDividendRun } from '@/lib/sacco/dividends';
import { serializeDividendRun } from '@/lib/sacco/serialize';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessSacco(ctx.staff)) {
      return forbiddenResponse('SACCO access is restricted to finance and admin users.');
    }

    const { id } = await context.params;

    try {
      const run = await ctx.run((tx) =>
        tx.saccoDividendRun.findFirst({
          where: { ...ctx.where(), id },
          include: {
            lines: {
              include: { member: true },
              orderBy: { dividendAmount: 'desc' },
            },
            _count: { select: { lines: true } },
          },
        }),
      );
      if (!run) return NextResponse.json({ error: 'Dividend run not found.' }, { status: 404 });

      return NextResponse.json({
        run: serializeDividendRun(run),
        lines: run.lines.map((line) => ({
          id: line.id,
          memberNumber: line.member.memberNumber,
          memberName: `${line.member.firstName} ${line.member.lastName}`.trim(),
          sharesBalance: Number(line.sharesBalance),
          dividendAmount: Number(line.dividendAmount),
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sacco/dividends/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load dividend run.' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessSacco(ctx.staff)) {
      return forbiddenResponse('SACCO access is restricted to finance and admin users.');
    }

    const { id } = await context.params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const action = typeof body.action === 'string' ? body.action.trim() : '';

    try {
      if (action === 'approve') {
        const run = await ctx.run((tx) =>
          tx.saccoDividendRun.update({
            where: { id, organizationId: ctx.organizationId },
            data: { status: 'approved', approvedAt: new Date() },
            include: { _count: { select: { lines: true } } },
          }),
        );
        return NextResponse.json({ run: serializeDividendRun(run) });
      }

      if (action === 'post') {
        const posted = await ctx.run((tx) => postDividendRun(tx, id, ctx.staff.id));
        const full = await ctx.run((tx) =>
          tx.saccoDividendRun.findFirstOrThrow({
            where: { ...ctx.where(), id: posted.id },
            include: { _count: { select: { lines: true } } },
          }),
        );
        return NextResponse.json({ run: serializeDividendRun(full) });
      }

      if (action === 'cancel') {
        const run = await ctx.run((tx) =>
          tx.saccoDividendRun.update({
            where: { id, organizationId: ctx.organizationId },
            data: { status: 'cancelled' },
            include: { _count: { select: { lines: true } } },
          }),
        );
        return NextResponse.json({ run: serializeDividendRun(run) });
      }

      return NextResponse.json({ error: 'Unknown action. Use approve, post, or cancel.' }, { status: 400 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update dividend run.';
      await reportApiError({
        route: 'PATCH /api/sacco/dividends/[id]',
        message,
      });
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
