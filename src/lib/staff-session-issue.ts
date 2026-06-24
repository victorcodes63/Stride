import type { UserRole } from '@prisma/client';
import { membershipForLogin } from '@/lib/org-membership';
import { buildStaffSessionValue } from '@/lib/staff-session-cookie';

export async function buildStaffSessionForUser(input: {
  provider: 'local' | 'ms' | 'google';
  userId: string;
  userRole: UserRole;
  email: string;
  preferredOrgId?: string | null;
}): Promise<string> {
  const membership = await membershipForLogin(
    input.userId,
    input.userRole,
    input.preferredOrgId,
  );
  return buildStaffSessionValue({
    provider: input.provider,
    userId: input.userId,
    currentOrgId: membership.organizationId,
    role: membership.role,
    email: input.provider === 'local' ? undefined : input.email,
  });
}
