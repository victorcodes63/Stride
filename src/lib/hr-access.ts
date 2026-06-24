import type { StaffUser } from '@/lib/staff-api-auth';

export function canAccessDisciplinaryRecords(user: StaffUser | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.staffUserType === 'operations' || user.staffUserType === 'business_manager';
}
