import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    try {
      const claim = await ctx.run((tx) =>
        tx.expenseClaim.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: { items: { orderBy: { date: 'asc' } } },
        }),
      );

      if (!claim) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({
        claim: {
          ...claim,
          totalAmount: Number(claim.totalAmount),
          items: claim.items.map((i) => ({
            ...i,
            amount: Number(i.amount),
            date: i.date.toISOString().split('T')[0],
          })),
        },
      });
    } catch (error) {
      await reportApiError({
        route: `GET /api/finance/expenses/${id}`,
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load expense claim.' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    try {
      const claim = await ctx.run((tx) =>
        tx.expenseClaim.findFirst({ where: { id, organizationId: ctx.organizationId } }),
      );
      if (!claim) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const action = body.action;

      if (action === 'submit') {
        if (claim.status !== 'draft') {
          return NextResponse.json({ error: 'Can only submit draft claims.' }, { status: 400 });
        }
        await ctx.run((tx) =>
          tx.expenseClaim.update({
            where: { id },
            data: { status: 'submitted', submittedAt: new Date() },
          }),
        );
        return NextResponse.json({ ok: true });
      }

      if (action === 'approve') {
        if (claim.status !== 'submitted') {
          return NextResponse.json({ error: 'Can only approve submitted claims.' }, { status: 400 });
        }
        await ctx.run((tx) =>
          tx.expenseClaim.update({
            where: { id },
            data: { status: 'approved', approvedAt: new Date(), approvedByUserId: ctx.staff.id },
          }),
        );
        return NextResponse.json({ ok: true });
      }

      if (action === 'reject') {
        if (claim.status !== 'submitted') {
          return NextResponse.json({ error: 'Can only reject submitted claims.' }, { status: 400 });
        }
        await ctx.run((tx) =>
          tx.expenseClaim.update({
            where: { id },
            data: {
              status: 'rejected',
              rejectionReason: typeof body.reason === 'string' ? body.reason.trim() || null : null,
            },
          }),
        );
        return NextResponse.json({ ok: true });
      }

      if (action === 'reimburse') {
        if (claim.status !== 'approved') {
          return NextResponse.json({ error: 'Can only reimburse approved claims.' }, { status: 400 });
        }
        await ctx.run((tx) =>
          tx.expenseClaim.update({
            where: { id },
            data: {
              status: 'reimbursed',
              reimbursedAt: new Date(),
              paymentReference:
                typeof body.paymentReference === 'string' ? body.paymentReference.trim() || null : null,
            },
          }),
        );
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    } catch (error) {
      await reportApiError({
        route: `PATCH /api/finance/expenses/${id}`,
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update expense claim.' }, { status: 500 });
    }
  });
}
