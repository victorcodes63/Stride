import type { StaffUser } from '@/lib/staff-api-auth';

/**
 * RBAC for the tenant-own (internal staff) rota module.
 *
 * Mirrors the intent of `@/lib/rota/api-auth` (outsourcing) but is scoped to
 * internal staff. Any authenticated staff member can *read* the rota; only
 * managers can create/update/delete templates, periods and assignments.
 *
 * Managers = platform admins OR the `business_manager` / `director` personas
 * (leadership who own workforce planning). Everyone else — including the
 * `viewer` role — is read-only.
 */
export function canManageStaffRota(u: StaffUser | null): boolean {
  if (!u) return false;
  if (u.role === 'viewer') return false;
  if (u.role === 'admin') return true;
  return u.staffUserType === 'business_manager' || u.staffUserType === 'director';
}

/** Any authenticated staff user may view the rota. */
export function canViewStaffRota(u: StaffUser | null): boolean {
  return Boolean(u);
}
