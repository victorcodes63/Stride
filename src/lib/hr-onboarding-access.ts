import type { StaffUser } from '@/lib/staff-api-auth';

export function canManageOnboarding(user: StaffUser): boolean {
  return (
    user.role === 'admin' ||
    user.staffUserType === 'operations' ||
    user.staffUserType === 'business_manager'
  );
}
