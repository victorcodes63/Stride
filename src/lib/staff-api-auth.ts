import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseStaffSession } from '@/lib/auth-session';
import { canApproveStaffLeave, canViewTeamLeaveQueue } from '@/lib/staff-permissions';
import { resolveMembership } from '@/lib/org-membership';
import { resolveStaffSessionOrgId } from '@/lib/staff-session-org';
import type { StaffUserType } from '@/types/dashboard';

const COOKIE = 'staff_session';

export type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'viewer';
  staffUserType: StaffUserType;
  mfaEnabled: boolean;
  currentOrgId: string;
};

export async function requireStaffUser(request: NextRequest): Promise<StaffUser | null> {
  const raw = request.cookies.get(COOKIE)?.value;
  if (!raw || !process.env.DATABASE_URL) return null;
  const parsed = parseStaffSession(raw);
  let user = null as Awaited<ReturnType<typeof prisma.user.findUnique>> | null;
  if (parsed.userId) {
    user = await prisma.user.findUnique({ where: { id: parsed.userId } });
  }
  if (!user && parsed.email) {
    user = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
  }
  if (!user?.isActive) return null;

  const currentOrgId = await resolveStaffSessionOrgId(parsed, user.id);
  if (!currentOrgId) return null;

  const membership = await resolveMembership(user.id, currentOrgId);
  const effectiveRole = (membership?.role ?? user.role) as StaffUser['role'];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: effectiveRole,
    staffUserType: user.staffUserType as StaffUserType,
    mfaEnabled: Boolean((user as { mfaEnabled?: boolean }).mfaEnabled),
    currentOrgId,
  };
}

export function isAdmin(u: StaffUser | null): boolean {
  return u?.role === 'admin';
}

/** Approve/reject internal staff leave (admin or business_manager). */
export function canApproveStaffLeaveRequests(u: StaffUser | null): boolean {
  if (!u) return false;
  return canApproveStaffLeave(u.role, u.staffUserType);
}

/** List team-wide leave applications (pending queue). */
export function canAccessTeamLeaveScope(u: StaffUser | null): boolean {
  if (!u) return false;
  return canViewTeamLeaveQueue(u.role, u.staffUserType);
}
