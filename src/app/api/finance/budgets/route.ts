import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const year = request.nextUrl.searchParams.get('year');
    const fiscalYear = year ? parseInt(year, 10) : new Date().getFullYear();

    const budgets = await prisma.budget.findMany({
      where: { fiscalYear },
      include: {
        items: { orderBy: { name: 'asc' } },
        _count: { select: { items: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      budgets: budgets.map((b) => ({
        id: b.id,
        name: b.name,
        department: b.department,
        category: b.category,
        fiscalYear: b.fiscalYear,
        periodType: b.periodType,
        currency: b.currency,
        allocatedAmount: Number(b.allocatedAmount),
        spentAmount: Number(b.spentAmount),
        utilizationPercent: Number(b.allocatedAmount) > 0
          ? Math.round((Number(b.spentAmount) / Number(b.allocatedAmount)) * 10000) / 100
          : 0,
        status: b.status,
        startDate: b.startDate.toISOString().split('T')[0],
        endDate: b.endDate.toISOString().split('T')[0],
        itemCount: b._count.items,
        items: b.items.map((i) => ({
          id: i.id,
          name: i.name,
          allocatedAmount: Number(i.allocatedAmount),
          spentAmount: Number(i.spentAmount),
        })),
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/finance/budgets',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load budgets.' }, { status: 500 });
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

  const { name, department, category, fiscalYear, periodType, currency, allocatedAmount, startDate, endDate, notes, items } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (!allocatedAmount || Number(allocatedAmount) <= 0) return NextResponse.json({ error: 'Valid allocated amount is required.' }, { status: 400 });

  try {
    const budget = await prisma.budget.create({
      data: {
        name: name.trim(),
        department: department?.trim() || null,
        category: category?.trim() || null,
        fiscalYear: fiscalYear || new Date().getFullYear(),
        periodType: periodType || 'annual',
        currency: currency || 'KES',
        allocatedAmount: Number(allocatedAmount),
        startDate: new Date(startDate || `${fiscalYear || new Date().getFullYear()}-01-01`),
        endDate: new Date(endDate || `${fiscalYear || new Date().getFullYear()}-12-31`),
        notes: notes?.trim() || null,
        createdByUserId: user.id,
        status: 'draft',
        items: Array.isArray(items) && items.length > 0
          ? {
              create: items.map((item: any) => ({
                name: item.name?.trim() || 'Line item',
                allocatedAmount: Number(item.allocatedAmount) || 0,
              })),
            }
          : undefined,
      },
    });

    return NextResponse.json({ id: budget.id }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/finance/budgets',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create budget.' }, { status: 500 });
  }
}
