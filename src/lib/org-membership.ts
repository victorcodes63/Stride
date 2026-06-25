import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';

export type ResolvedMembership = {
  id: string;
  organizationId: string;
  role: UserRole;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

/** Default org created by tenancy migration (single-tenant backfill). */
export const DEFAULT_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

/** Set RLS login scope so membership rows for this user are readable pre-session. */
async function withLoginUserScope<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await prisma.$executeRaw`SELECT set_config('app.login_user_id', ${userId}, true)`;
  try {
    return await fn();
  } finally {
    await prisma.$executeRaw`SELECT set_config('app.login_user_id', '', true)`;
  }
}

export async function listActiveMemberships(userId: string): Promise<ResolvedMembership[]> {
  return prisma.organizationMembership.findMany({
    where: { userId, status: 'active' },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/** Resolve org + per-org role for session; prefers explicit org, else first membership. */
export async function resolveMembership(
  userId: string,
  preferredOrgId?: string | null,
): Promise<ResolvedMembership | null> {
  const rows = await listActiveMemberships(userId);
  if (rows.length === 0) return null;
  if (preferredOrgId) {
    const match = rows.find((row) => row.organizationId === preferredOrgId);
    if (match) return match;
  }
  return rows[0] ?? null;
}

/** Attach user to default org when no membership exists (legacy single-tenant users). */
export async function ensureDefaultMembership(
  userId: string,
  role: UserRole,
): Promise<ResolvedMembership> {
  return withOrgContext(DEFAULT_ORGANIZATION_ID, (tx) =>
    tx.organizationMembership.upsert({
      where: {
        userId_organizationId: { userId, organizationId: DEFAULT_ORGANIZATION_ID },
      },
      create: {
        userId,
        organizationId: DEFAULT_ORGANIZATION_ID,
        role,
        updatedAt: new Date(),
      },
      update: {},
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    }),
  );
}

export async function membershipForLogin(
  userId: string,
  userRole: UserRole,
  preferredOrgId?: string | null,
): Promise<ResolvedMembership> {
  return withLoginUserScope(userId, async () => {
    if (preferredOrgId) {
      const preferred = await resolveMembership(userId, preferredOrgId);
      if (preferred) return preferred;
    }

    const demoPack = process.env.DEMO_PACK?.trim();
    if (demoPack) {
      const demoSlug = `demo-${demoPack}`;
      const demoMembership = await prisma.organizationMembership.findFirst({
        where: {
          userId,
          status: 'active',
          organization: { slug: demoSlug },
        },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      });
      if (demoMembership) return demoMembership;
    }

    const resolved = await resolveMembership(userId, preferredOrgId);
    if (resolved) return resolved;
    return ensureDefaultMembership(userId, userRole);
  });
}
