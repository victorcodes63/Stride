import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    const leaveTypes = await ctx.run((tx) =>
      tx.leaveType.findMany({
        where: ctx.where(),
        orderBy: { name: 'asc' },
        select: { id: true, name: true, daysPerYear: true },
      }),
    );

    return NextResponse.json(leaveTypes);
  });
}
