import type { UserRole } from '@prisma/client';
import { membershipForLogin } from '@/lib/org-membership';
import { buildStaffSessionValue } from '@/lib/staff-session-cookie';
import { resolveOrgByEmail } from '@/lib/auth/resolve-org-by-email';

export async function buildStaffSessionForUser(input: {
  provider: 'local' | 'ms' | 'google';
  userId: string;
  userRole: UserRole;
  email?: string;
  preferredOrgId?: string | null;
}): Promise<string> {
  let preferredOrgId = input.preferredOrgId ?? null;
  if (!preferredOrgId && input.email?.includes('@')) {
    const resolved = await resolveOrgByEmail(input.email.trim().toLowerCase(), 'staff');
    if (resolved?.verifiedDomain) {
      preferredOrgId = resolved.organizationId;
    }
  }

  const membership = await membershipForLogin(
    input.userId,
    input.userRole,
    preferredOrgId,
    input.email,
  );
  return buildStaffSessionValue({
    provider: input.provider,
    userId: input.userId,
    currentOrgId: membership.organizationId,
    role: membership.role,
    email: input.provider === 'local' ? undefined : input.email,
  });
}
