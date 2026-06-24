import type { UserRole } from '@prisma/client';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildStaffSessionValue(input: {
  provider: 'local' | 'ms' | 'google';
  userId: string;
  currentOrgId: string;
  role: UserRole | string;
  email?: string;
  issuedAt?: number;
}): string {
  const issuedAt = input.issuedAt ?? Math.floor(Date.now() / 1000);
  if (input.provider === 'local') {
    return `local:${input.userId}:${input.currentOrgId}:${input.role}:${issuedAt}`;
  }
  if (!input.email) {
    throw new Error('OAuth staff session requires email');
  }
  return `${input.provider}:${input.userId}:${input.currentOrgId}:${input.role}:${input.email}:${issuedAt}`;
}

/** Parse org id from legacy or new session segments. */
export function parseSessionOrgId(parts: string[], roleIndex: number): string | undefined {
  const candidate = parts[roleIndex];
  if (candidate && UUID_RE.test(candidate)) return candidate;
  return undefined;
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
