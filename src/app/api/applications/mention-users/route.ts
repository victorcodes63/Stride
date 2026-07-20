import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export type MentionUser = {
  id: string;
  name: string;
  email: string;
};

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ users: [] });
    }
    try {
      const memberships = await ctx.run((tx) =>
        tx.organizationMembership.findMany({
          where: { organizationId: ctx.organizationId, status: 'active' },
          include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
        }),
      );
      const users: MentionUser[] = memberships
        .map((m) => m.user)
        .filter((u): u is NonNullable<typeof u> => !!u && u.isActive)
        .map((u) => ({ id: u.id, name: u.name, email: u.email }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      return NextResponse.json({ users });
    } catch {
      return NextResponse.json({ users: [] });
    }
  });
}
