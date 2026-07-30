import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    const fetchAll = request.nextUrl.searchParams.get('all') === '1';
    const staff = await ctx.run((tx) =>
      tx.user.findMany({
        where: {
          isActive: true,
          organizationMemberships: { some: { organizationId: ctx.organizationId } },
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
        take: fetchAll ? 500 : 50,
      }),
    );
    return NextResponse.json({ staff });
  });
}
