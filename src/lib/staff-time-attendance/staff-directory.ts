import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export type OrgStaffUser = {
  id: string;
  name: string;
  email: string;
  staffUserType: string;
  department: string | null;
  role: string;
};

/**
 * List active internal staff Users for the tenant organization.
 *
 * Internal staff (the tenant's own workforce for tenant-own Time & Attendance)
 * are Users with an active OrganizationMembership in `organizationId`. This is
 * the canonical subject set for the dashboard Rota / Attendance / Biometric
 * modules (as opposed to outsourcing, which is keyed on Employee + end client).
 *
 * Call inside `ctx.run(...)` and pass `ctx.organizationId`.
 */
export async function listOrgStaffUsers(
  db: Db,
  organizationId: string,
  opts?: { search?: string; department?: string | null; includeInactive?: boolean },
): Promise<OrgStaffUser[]> {
  const memberships = await db.organizationMembership.findMany({
    where: { organizationId, status: 'active' },
    select: { userId: true, role: true },
  });
  if (memberships.length === 0) return [];

  const roleByUser = new Map(memberships.map((m) => [m.userId, String(m.role)]));
  const userIds = memberships.map((m) => m.userId);

  const users = await db.user.findMany({
    where: {
      id: { in: userIds },
      ...(opts?.includeInactive ? {} : { isActive: true }),
      ...(opts?.department ? { department: opts.department } : {}),
      ...(opts?.search
        ? {
            OR: [
              { name: { contains: opts.search, mode: 'insensitive' as const } },
              { email: { contains: opts.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, staffUserType: true, department: true },
    orderBy: { name: 'asc' },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    staffUserType: String(u.staffUserType),
    department: u.department ?? null,
    role: roleByUser.get(u.id) ?? 'staff',
  }));
}

/** Set of active staff user ids for the org (handy for `{ userId: { in: ... } }` filters). */
export async function listOrgStaffUserIds(db: Db, organizationId: string): Promise<string[]> {
  const memberships = await db.organizationMembership.findMany({
    where: { organizationId, status: 'active' },
    select: { userId: true },
  });
  return memberships.map((m) => m.userId);
}
