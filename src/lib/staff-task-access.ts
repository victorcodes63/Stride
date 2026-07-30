import type { StaffUser } from '@/lib/staff-api-auth';
import { canAccessCompanyTasks, isAdmin } from '@/lib/staff-api-auth';

export type StaffTaskRow = {
  id: string;
  createdById: string;
  assigneeId: string | null;
};

export function canViewStaffTask(user: StaffUser, task: StaffTaskRow): boolean {
  if (isAdmin(user) || canAccessCompanyTasks(user)) return true;
  return task.createdById === user.id || task.assigneeId === user.id;
}

export function canEditStaffTask(user: StaffUser, task: StaffTaskRow): boolean {
  if (isAdmin(user) || canAccessCompanyTasks(user)) return true;
  return task.createdById === user.id || task.assigneeId === user.id;
}

export function canDeleteStaffTask(user: StaffUser, task: StaffTaskRow): boolean {
  if (isAdmin(user)) return true;
  return task.createdById === user.id;
}
