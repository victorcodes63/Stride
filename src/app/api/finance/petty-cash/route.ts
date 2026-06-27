import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const funds = await ctx.run((tx) =>
        tx.pettyCashFund.findMany({
          where: { organizationId: ctx.organizationId },
          include: {
            transactions: { orderBy: { date: 'desc' }, take: 50 },
            _count: { select: { transactions: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      );

      return NextResponse.json({
        funds: funds.map((f) => ({
          id: f.id,
          name: f.name,
          currency: f.currency,
          floatAmount: Number(f.floatAmount),
          currentBalance: Number(f.currentBalance),
          status: f.status,
          custodianName: f.custodianName,
          transactionCount: f._count.transactions,
          recentTransactions: f.transactions.map((t) => ({
            id: t.id,
            type: t.type,
            amount: Number(t.amount),
            date: t.date.toISOString().split('T')[0],
            description: t.description,
            category: t.category,
            reference: t.reference,
          })),
          createdAt: f.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/finance/petty-cash',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load petty cash funds.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const action = body.action;
    const fundId = typeof body.fundId === 'string' ? body.fundId : undefined;
    const amount = body.amount;
    const description = typeof body.description === 'string' ? body.description : '';
    const date = body.date;
    const category = typeof body.category === 'string' ? body.category : undefined;
    const reference = typeof body.reference === 'string' ? body.reference : undefined;
    const name = typeof body.name === 'string' ? body.name : '';
    const floatAmount = body.floatAmount;
    const currency = typeof body.currency === 'string' ? body.currency : 'KES';
    const custodianName = typeof body.custodianName === 'string' ? body.custodianName : undefined;
    const notes = typeof body.notes === 'string' ? body.notes : undefined;

    if (action === 'transaction') {
      if (!fundId || !amount || !description.trim()) {
        return NextResponse.json({ error: 'Fund ID, amount, and description are required.' }, { status: 400 });
      }

      try {
        const result = await ctx.run(async (tx) => {
          const fund = await tx.pettyCashFund.findFirst({
            where: { id: fundId, organizationId: ctx.organizationId },
          });
          if (!fund) return null;

          const txType = typeof body.transactionType === 'string' ? body.transactionType : 'disbursement';
          const txAmount = Number(amount);

          let newBalance = Number(fund.currentBalance);
          if (txType === 'replenishment' || txType === 'refund') {
            newBalance += txAmount;
          } else {
            newBalance -= txAmount;
          }

          await tx.pettyCashTransaction.create({
            data: {
              organizationId: ctx.organizationId,
              fundId,
              type: txType as never,
              amount: txAmount,
              date: new Date(String(date || new Date())),
              description: description.trim(),
              category: category?.trim() || null,
              reference: reference?.trim() || null,
              createdByUserId: ctx.staff.id,
            },
          });
          await tx.pettyCashFund.update({
            where: { id: fundId },
            data: { currentBalance: Math.round(newBalance * 100) / 100 },
          });

          return Math.round(newBalance * 100) / 100;
        });

        if (result === null) return NextResponse.json({ error: 'Fund not found.' }, { status: 404 });
        return NextResponse.json({ ok: true, newBalance: result });
      } catch (error) {
        await reportApiError({
          route: 'POST /api/finance/petty-cash (transaction)',
          message: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: 'Failed to record transaction.' }, { status: 500 });
      }
    }

    if (!name.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    if (!floatAmount || Number(floatAmount) <= 0) {
      return NextResponse.json({ error: 'Valid float amount is required.' }, { status: 400 });
    }

    try {
      const fund = await ctx.run((tx) =>
        tx.pettyCashFund.create({
          data: {
            organizationId: ctx.organizationId,
            name: name.trim(),
            floatAmount: Number(floatAmount),
            currentBalance: Number(floatAmount),
            currency: currency || 'KES',
            custodianUserId: ctx.staff.id,
            custodianName: custodianName?.trim() || ctx.staff.name,
            notes: notes?.trim() || null,
          },
        }),
      );

      return NextResponse.json({ id: fund.id }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/finance/petty-cash',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create petty cash fund.' }, { status: 500 });
    }
  });
}
