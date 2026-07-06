import { NextRequest, NextResponse } from 'next/server';

import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const divisions = await ctx.run((tx) =>
      tx.jdDivision.findMany({
        where: ctx.where(),
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: { select: { jobDescriptions: true } },
        },
      }),
    );

    return NextResponse.json({
      divisions: divisions.map((d) => ({
        id: d.id,
        name: d.name,
        sortOrder: d.sortOrder,
        isReferencePack: d.isReferencePack,
        jobDescriptionCount: d._count.jobDescriptions,
      })),
    });
  });
}
