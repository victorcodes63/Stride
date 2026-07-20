import type { StaffUser } from '@/lib/staff-api-auth';
import type { StaffUserType, UserRole } from '@/types/dashboard';

/**
 * RBAC for the tenant-own (internal staff) Attendance module.
 *
 * Read access: any authenticated staff member (viewers included).
 * Manage access (manual overrides, approvals, exception resolution, policy /
 * work-site CRUD): org admins and business managers only. Mirrors the leave
 * module's `canApproveStaffLeave` convention.
 */
export function canManageStaffAttendance(role: UserRole, staffUserType: StaffUserType): boolean {
  if (role === 'admin') return true;
  return staffUserType === 'business_manager' || staffUserType === 'director';
}

/** Convenience wrapper around a resolved `StaffUser` (from `withTenant`). */
export function staffUserCanManageAttendance(user: StaffUser | null | undefined): boolean {
  if (!user) return false;
  return canManageStaffAttendance(user.role, user.staffUserType);
}
