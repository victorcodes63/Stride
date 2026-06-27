import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';
import { resolveOrgByEmail } from '@/lib/auth/resolve-org-by-email';
import { withOrgContext } from '@/lib/org-context';
import { isDemoSandboxCell } from '@/lib/deployment-cell';
import { DEFAULT_ORGANIZATION_ID } from '@/lib/org-constants';

export { DEFAULT_ORGANIZATION_ID } from '@/lib/org-constants';

export class NoOrgMembershipForLoginError extends Error {
  constructor(
    message = 'No organization access for this account. Ask your administrator for an invitation.',
  ) {
    super(message);
    this.name = 'NoOrgMembershipForLoginError';
  }
}

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

/** Set RLS login scope so membership rows for this user are readable pre-session. */
async function withLoginUserScope<T>(
  userId: string,
  fn: (db: typeof prisma) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.login_user_id', ${userId}, true)`;
    return fn(tx as typeof prisma);
  });
}

export async function listActiveMemberships(
  userId: string,
  db: typeof prisma = prisma,
): Promise<ResolvedMembership[]> {
  return db.organizationMembership.findMany({
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
  db: typeof prisma = prisma,
): Promise<ResolvedMembership | null> {
  const rows = await listActiveMemberships(userId, db);
  if (rows.length === 0) return null;
  if (preferredOrgId) {
    const match = rows.find((row) => row.organizationId === preferredOrgId);
    if (match) return match;
  }
  return rows[0] ?? null;
}

/** Read memberships before app.current_org is set (session validation, /api/auth/me). */
export async function listActiveMembershipsWithLoginScope(
  userId: string,
): Promise<ResolvedMembership[]> {
  return withLoginUserScope(userId, (db) => listActiveMemberships(userId, db));
}

export async function resolveMembershipWithLoginScope(
  userId: string,
  preferredOrgId?: string | null,
): Promise<ResolvedMembership | null> {
  return withLoginUserScope(userId, (db) => resolveMembership(userId, preferredOrgId, db));
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
  email?: string | null,
): Promise<ResolvedMembership> {
  return withLoginUserScope(userId, async (db) => {
    if (preferredOrgId) {
      const preferred = await resolveMembership(userId, preferredOrgId, db);
      if (preferred) return preferred;
    }

    const normalizedEmail = email?.trim().toLowerCase();
    let verifiedDomainOrgId: string | null = null;
    if (normalizedEmail && normalizedEmail.includes('@')) {
      const resolved = await resolveOrgByEmail(normalizedEmail, 'staff');
      if (resolved?.verifiedDomain) {
        verifiedDomainOrgId = resolved.organizationId;
        const domainMembership = await resolveMembership(userId, resolved.organizationId, db);
        if (domainMembership) return domainMembership;
      }
    }

    if (isDemoSandboxCell()) {
      const demoPack = process.env.DEMO_PACK?.trim();
      if (demoPack) {
        const demoSlug = `demo-${demoPack}`;
        const demoMembership = await db.organizationMembership.findFirst({
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
    }

    const resolved = await resolveMembership(userId, preferredOrgId, db);
    if (resolved) return resolved;

    if (verifiedDomainOrgId) {
      throw new NoOrgMembershipForLoginError();
    }

    if (isDemoSandboxCell()) {
      return ensureDefaultMembership(userId, userRole);
    }

    throw new NoOrgMembershipForLoginError();
  });
}
