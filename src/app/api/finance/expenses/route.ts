import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
      const claims = await ctx.run((tx) =>
        tx.expenseClaim.findMany({
          where: ctx.where(status ? { status: status as never } : {}),
          include: {
            items: { orderBy: { date: 'asc' } },
            _count: { select: { items: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      );

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

    const claimantName = typeof body.claimantName === 'string' ? body.claimantName : '';
    const department = typeof body.department === 'string' ? body.department : undefined;
    const description = typeof body.description === 'string' ? body.description : '';
    const currency = typeof body.currency === 'string' ? body.currency : 'KES';
    const items = body.items;

    if (!claimantName.trim() || !description.trim()) {
      return NextResponse.json({ error: 'Claimant name and description are required.' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one expense item is required.' }, { status: 400 });
    }

    try {
      const claim = await ctx.run(async (tx) => {
        const count = await tx.expenseClaim.count({ where: { organizationId: ctx.organizationId } });
        const claimNumber = `EXP-${String(count + 1).padStart(4, '0')}`;
        const totalAmount = items.reduce(
          (sum: number, item: Record<string, unknown>) => sum + (Number(item.amount) || 0),
          0,
        );

        return tx.expenseClaim.create({
          data: {
            organizationId: ctx.organizationId,
            claimNumber,
            userId: ctx.staff.id,
            claimantName: claimantName.trim(),
            department: department?.trim() || null,
            description: description.trim(),
            currency: currency || 'KES',
            totalAmount,
            status: 'draft',
            items: {
              create: items.map((item: Record<string, unknown>) => ({
                organizationId: ctx.organizationId,
                date: new Date(String(item.date)),
                category: (typeof item.category === 'string' ? item.category : 'other') as never,
                description: typeof item.description === 'string' ? item.description.trim() || 'Expense' : 'Expense',
                amount: Number(item.amount) || 0,
                receiptPath: typeof item.receiptPath === 'string' ? item.receiptPath : null,
                notes: typeof item.notes === 'string' ? item.notes.trim() || null : null,
              })),
            },
          },
        });
      });

      return NextResponse.json({ id: claim.id, claimNumber: claim.claimNumber }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/finance/expenses',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create expense claim.' }, { status: 500 });
    }
  });
}
