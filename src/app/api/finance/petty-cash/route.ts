import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const funds = await prisma.pettyCashFund.findMany({
      include: {
        transactions: { orderBy: { date: 'desc' }, take: 50 },
        _count: { select: { transactions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

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
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, floatAmount, currency, custodianName, notes, action, fundId, amount, date, description, category, reference } = body;

  if (action === 'transaction') {
    if (!fundId || !amount || !description?.trim()) {
      return NextResponse.json({ error: 'Fund ID, amount, and description are required.' }, { status: 400 });
    }

    try {
      const fund = await prisma.pettyCashFund.findUnique({ where: { id: fundId } });
      if (!fund) return NextResponse.json({ error: 'Fund not found.' }, { status: 404 });

      const txType = body.transactionType || 'disbursement';
      const txAmount = Number(amount);

      let newBalance = Number(fund.currentBalance);
      if (txType === 'replenishment' || txType === 'refund') {
        newBalance += txAmount;
      } else {
        newBalance -= txAmount;
      }

      await prisma.$transaction([
        prisma.pettyCashTransaction.create({
          data: {
            fundId,
            type: txType,
            amount: txAmount,
            date: new Date(date || new Date()),
            description: description.trim(),
            category: category?.trim() || null,
            reference: reference?.trim() || null,
            createdByUserId: user.id,
          },
        }),
        prisma.pettyCashFund.update({
          where: { id: fundId },
          data: { currentBalance: Math.round(newBalance * 100) / 100 },
        }),
      ]);

      return NextResponse.json({ ok: true, newBalance: Math.round(newBalance * 100) / 100 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/finance/petty-cash (transaction)',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to record transaction.' }, { status: 500 });
    }
  }

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (!floatAmount || Number(floatAmount) <= 0) return NextResponse.json({ error: 'Valid float amount is required.' }, { status: 400 });

  try {
    const fund = await prisma.pettyCashFund.create({
      data: {
        name: name.trim(),
        floatAmount: Number(floatAmount),
        currentBalance: Number(floatAmount),
        currency: currency || 'KES',
        custodianUserId: user.id,
        custodianName: custodianName?.trim() || user.name,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json({ id: fund.id }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/finance/petty-cash',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create petty cash fund.' }, { status: 500 });
  }
}
