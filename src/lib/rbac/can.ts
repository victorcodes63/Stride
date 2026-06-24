import { prisma } from '@/lib/prisma';
import type { StaffUser } from '@/lib/staff-api-auth';
import type { UserRole } from '@/types/dashboard';

/**
 * Check whether the staff user has a permission in the current org (RAV-64).
 * Uses RolePermission defaults + per-user overrides scoped by organizationId.
 */
export async function can(staff: StaffUser, permissionKey: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) return staff.role === 'admin';

  const def = await prisma.permissionDefinition.findUnique({
    where: { key: permissionKey },
    include: { rolePermissions: true },
  });
  if (!def) return false;

  const override = await prisma.userPermissionOverride.findFirst({
    where: {
      userId: staff.id,
      permissionId: def.id,
      organizationId: staff.currentOrgId,
    },
  });
  if (override) return override.isAllowed;

  const rolePerm = def.rolePermissions.find((rp) => rp.role === staff.role);
  return rolePerm?.isAllowed ?? false;
}

export async function requirePermission(staff: StaffUser, permissionKey: string): Promise<void> {
  const allowed = await can(staff, permissionKey);
  if (!allowed) {
    throw new TenantForbiddenError(`Missing permission: ${permissionKey}`);
  }
}

export function isAdminRole(role: UserRole): boolean {
  return role === 'admin';
}

export class TenantForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantForbiddenError';
  }
}
