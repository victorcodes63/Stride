import type { StaffUser } from '@/lib/staff-api-auth';

export function canWriteRota(u: StaffUser | null): boolean {
  if (!u) return false;
  return u.role !== 'viewer';
}
