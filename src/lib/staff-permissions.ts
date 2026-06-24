import { STAFF_USER_TYPES, type StaffUserType, type UserRole } from '@/types/dashboard';

export const STAFF_USER_TYPE_LABELS: Record<StaffUserType, string> = {
  operations: 'Operations & consulting',
  business_manager: 'Business manager',
  finance: 'Finance / Accounts',
  director: 'Director',
};

/** System-wide analytics / executive summary (sidebar + /dashboard/analytics). */
export function canViewSystemAnalytics(role: UserRole, staffUserType: StaffUserType): boolean {
  if (role === 'admin') return true;
  return staffUserType === 'director';
}

export function isStaffUserType(value: string): value is StaffUserType {
  return (STAFF_USER_TYPES as readonly string[]).includes(value);
}

export function canApproveStaffLeave(role: UserRole, staffUserType: StaffUserType): boolean {
  if (role === 'admin') return true;
  return staffUserType === 'business_manager';
}

export function canViewTeamLeaveQueue(role: UserRole, staffUserType: StaffUserType): boolean {
  return canApproveStaffLeave(role, staffUserType);
}
