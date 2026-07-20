import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

/** List imported external assessments that can be assigned to jobs. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const items = await ctx.run((tx) =>
      tx.externalAssessment.findMany({
        where: ctx.where({ isActive: true }),
        select: {
          id: true,
          name: true,
          provider: true,
          category: true,
          durationMinutes: true,
          dimensions: true,
          connection: { select: { label: true } },
        },
        orderBy: { name: 'asc' },
      }),
    );
    return NextResponse.json(items);
  });
}
