import { NextRequest, NextResponse } from 'next/server';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

/** Lightweight assignee picker for HR creating/reassigning onboarding tasks. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canManageOnboarding(ctx.staff)) {
      return forbiddenResponse('Assignee picker requires HR privileges.');
    }

    const q = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() ?? '';

    const memberships = await ctx.run((tx) =>
      tx.organizationMembership.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: 'active',
          user: { isActive: true },
        },
        include: {
          user: { select: { id: true, name: true, email: true, staffUserType: true, role: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );

    let users = memberships.map((m) => m.user);
    if (q) {
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }
    users.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        staffUserType: u.staffUserType,
      })),
    );
  });
}
