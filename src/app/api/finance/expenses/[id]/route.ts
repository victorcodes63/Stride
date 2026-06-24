import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const claim = await prisma.expenseClaim.findUnique({
      where: { id },
      include: { items: { orderBy: { date: 'asc' } } },
    });

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
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const claim = await prisma.expenseClaim.findUnique({ where: { id } });
    if (!claim) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { action } = body;

    if (action === 'submit') {
      if (claim.status !== 'draft') {
        return NextResponse.json({ error: 'Can only submit draft claims.' }, { status: 400 });
      }
      await prisma.expenseClaim.update({
        where: { id },
        data: { status: 'submitted', submittedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'approve') {
      if (claim.status !== 'submitted') {
        return NextResponse.json({ error: 'Can only approve submitted claims.' }, { status: 400 });
      }
      await prisma.expenseClaim.update({
        where: { id },
        data: { status: 'approved', approvedAt: new Date(), approvedByUserId: user.id },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'reject') {
      if (claim.status !== 'submitted') {
        return NextResponse.json({ error: 'Can only reject submitted claims.' }, { status: 400 });
      }
      await prisma.expenseClaim.update({
        where: { id },
        data: {
          status: 'rejected',
          rejectionReason: body.reason?.trim() || null,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'reimburse') {
      if (claim.status !== 'approved') {
        return NextResponse.json({ error: 'Can only reimburse approved claims.' }, { status: 400 });
      }
      await prisma.expenseClaim.update({
        where: { id },
        data: {
          status: 'reimbursed',
          reimbursedAt: new Date(),
          paymentReference: body.paymentReference?.trim() || null,
        },
      });
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
}
