/**
 * Pre-login auth reads (email domain → org) run without a real tenant session.
 * Legacy RLS policies cast app.current_org to uuid; an empty string throws 22P02.
 * Set a non-tenant sentinel org id so tenant_rw policies evaluate false while
 * auth_public_lookup policies still allow verified-domain reads.
 */

import { prisma } from '@/lib/prisma';

/** UUID that must not match any Organization.id in production data. */
export const AUTH_PUBLIC_LOOKUP_ORG_SENTINEL = '00000000-0000-4000-8000-000000000000';

export async function withAuthPublicLookup<T>(
  fn: (db: typeof prisma) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org', ${AUTH_PUBLIC_LOOKUP_ORG_SENTINEL}, true)`;
    await tx.$executeRaw`SELECT set_config('app.auth_public_lookup', 'true', true)`;
    return fn(tx as typeof prisma);
  });
}
