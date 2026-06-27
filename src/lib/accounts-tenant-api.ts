import { NextRequest, NextResponse } from 'next/server';
import { withTenant, type TenantContext } from '@/lib/tenant-api';
import { getAccountsAccess } from '@/lib/accounts-access';

/** Tenant-scoped accounts/finance handler with access check. */
export async function withAccountsTenant(
  request: NextRequest,
  handler: (ctx: TenantContext) => Promise<NextResponse>,
) {
  return withTenant(request, async (ctx) => {
    const access = await getAccountsAccess(ctx.staff.id, ctx.staff.role);
    if (!access.hasAccountsAccess) {
      return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
    }
    return handler(ctx);
  });
}
