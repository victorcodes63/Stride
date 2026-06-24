import { NextRequest, NextResponse } from 'next/server';

import { serializeReview } from '@/lib/performance/service';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const cycleId = new URL(request.url).searchParams.get('cycleId')?.trim();
    if (!cycleId) {
      return NextResponse.json({ error: 'cycleId is required' }, { status: 400 });
    }

    const reviews = await ctx.run((tx) =>
      tx.performanceReview.findMany({
        where: ctx.where({ cycleId }),
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeNumber: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
      }),
    );

    const statusCounts = reviews.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return NextResponse.json({
      reviews: reviews.map(serializeReview),
      statusCounts,
      total: reviews.length,
    });
  });
}
