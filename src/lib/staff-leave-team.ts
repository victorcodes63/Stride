import { prisma } from '@/lib/prisma';
import { canApproveStaffLeave } from '@/lib/staff-permissions';
import type { StaffUserType, UserRole } from '@/types/dashboard';

export type LeaveTeamViewer = {
  id: string;
  role: UserRole;
  staffUserType: StaffUserType;
};

/** User ids visible on team overview / approvals for this viewer. */
export async function getTeamLeaveMemberIds(viewer: LeaveTeamViewer): Promise<string[]> {
  if (viewer.role === 'admin') {
    const all = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return all.map((u) => u.id);
  }

  if (!canApproveStaffLeave(viewer.role, viewer.staffUserType)) {
    return [viewer.id];
  }

  const reportees = await prisma.user.findMany({
    where: { isActive: true, leaveApproverId: viewer.id },
    select: { id: true },
  });
  return reportees.map((u) => u.id);
}

export async function canViewerApproveLeaveForUser(
  viewer: LeaveTeamViewer,
  applicantUserId: string,
): Promise<boolean> {
  if (viewer.role === 'admin') return true;
  if (!canApproveStaffLeave(viewer.role, viewer.staffUserType)) return false;
  if (viewer.id === applicantUserId) return false;
  const applicant = await prisma.user.findUnique({
    where: { id: applicantUserId },
    select: { leaveApproverId: true },
  });
  return applicant?.leaveApproverId === viewer.id;
}
