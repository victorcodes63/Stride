import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
    const claims = await prisma.expenseClaim.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        items: { orderBy: { date: 'asc' } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({
      claims: claims.map((c) => ({
        id: c.id,
        claimNumber: c.claimNumber,
        claimantName: c.claimantName,
        department: c.department,
        description: c.description,
        currency: c.currency,
        totalAmount: Number(c.totalAmount),
        status: c.status,
        itemCount: c._count.items,
        submittedAt: c.submittedAt?.toISOString() ?? null,
        approvedAt: c.approvedAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/finance/expenses',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load expense claims.' }, { status: 500 });
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

  const { claimantName, department, description, currency, items } = body;
  if (!claimantName?.trim() || !description?.trim()) {
    return NextResponse.json({ error: 'Claimant name and description are required.' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'At least one expense item is required.' }, { status: 400 });
  }

  try {
    const count = await prisma.expenseClaim.count();
    const claimNumber = `EXP-${String(count + 1).padStart(4, '0')}`;
    const totalAmount = items.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);

    const claim = await prisma.expenseClaim.create({
      data: {
        claimNumber,
        userId: user.id,
        claimantName: claimantName.trim(),
        department: department?.trim() || null,
        description: description.trim(),
        currency: currency || 'KES',
        totalAmount,
        status: 'draft',
        items: {
          create: items.map((item: any) => ({
            date: new Date(item.date),
            category: item.category || 'other',
            description: item.description?.trim() || 'Expense',
            amount: Number(item.amount) || 0,
            receiptPath: item.receiptPath || null,
            notes: item.notes?.trim() || null,
          })),
        },
      },
    });

    return NextResponse.json({ id: claim.id, claimNumber: claim.claimNumber }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/finance/expenses',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create expense claim.' }, { status: 500 });
  }
}
