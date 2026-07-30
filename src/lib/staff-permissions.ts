import { STAFF_USER_TYPES, type StaffUserType, type UserRole } from '@/types/dashboard';

export const STAFF_USER_TYPE_LABELS: Record<StaffUserType, string> = {
  operations: 'Operations & consulting',
  business_manager: 'Business manager',
  finance: 'Finance / Accounts',
  director: 'Director',
  sales_rep: 'Sales rep',
  sales_manager: 'Sales manager',
};

/** System-wide analytics / executive summary (sidebar + /dashboard/analytics). */
export function canViewSystemAnalytics(role: UserRole, staffUserType: StaffUserType): boolean {
  if (role === 'admin') return true;
  return staffUserType === 'director';
}

/** Company-wide personal task list (scope=all / company). */
export function canViewCompanyTasks(role: UserRole, staffUserType: StaffUserType): boolean {
  if (role === 'admin') return true;
  return staffUserType === 'business_manager' || staffUserType === 'director';
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

/** Sales managers + leadership see all deals; reps only see their own. */
export function canViewAllSalesDeals(role: UserRole, staffUserType: StaffUserType): boolean {
  if (role === 'admin') return true;
  return (
    staffUserType === 'sales_manager' ||
    staffUserType === 'business_manager' ||
    staffUserType === 'director'
  );
}

/** Sales settings / quote approval / manage (admin, sales manager, leadership). */
export function canManageSalesAdmin(role: UserRole, staffUserType: StaffUserType): boolean {
  return canViewAllSalesDeals(role, staffUserType);
}

/** Approve / edit team quotas and commission push to payroll. */
export function canManageSalesTargets(role: UserRole, staffUserType: StaffUserType): boolean {
  if (role === 'admin') return true;
  return (
    staffUserType === 'sales_manager' ||
    staffUserType === 'business_manager' ||
    staffUserType === 'director' ||
    staffUserType === 'finance'
  );
}
