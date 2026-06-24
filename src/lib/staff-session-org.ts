import type { ParsedStaffSession } from '@/lib/auth-session';
import { resolveMembership } from '@/lib/org-membership';

/** Resolve tenant org from session cookie (supports legacy cookies without org id). */
export async function resolveStaffSessionOrgId(
  parsed: ParsedStaffSession,
  userId: string,
): Promise<string | null> {
  if (parsed.currentOrgId) {
    const match = await resolveMembership(userId, parsed.currentOrgId);
    if (match) return match.organizationId;
  }
  const fallback = await resolveMembership(userId);
  return fallback?.organizationId ?? null;
}
