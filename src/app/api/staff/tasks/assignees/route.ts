import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/** Active org members for task assignment (any authenticated dashboard user). */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const memberships = await ctx.run((tx) =>
      tx.organizationMembership.findMany({
        where: { organizationId: ctx.organizationId, status: 'active' },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true, isActive: true },
          },
        },
        orderBy: { user: { name: 'asc' } },
      }),
    );

    const users = memberships
      .map((m) => m.user)
      .filter((u): u is NonNullable<typeof u> => Boolean(u?.isActive))
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      }));

    return NextResponse.json(users);
  });
}
