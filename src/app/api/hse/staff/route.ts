import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/**
 * Lightweight, tenant-scoped list of active staff users for CAPA assignee pickers.
 * Non-admin safe (read-only), returns only id/name/email.
 */
export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ staff: [] });
  }

  return withTenant(request, async (ctx) => {
    try {
      const memberships = await ctx.run((tx) =>
        tx.organizationMembership.findMany({
          where: { organizationId: ctx.organizationId, status: 'active' },
          select: { user: { select: { id: true, name: true, email: true } } },
        }),
      );

      const seen = new Set<string>();
      const staff = memberships
        .map((m) => m.user)
        .filter((u): u is { id: string; name: string; email: string } => {
          if (!u || seen.has(u.id)) return false;
          seen.add(u.id);
          return true;
        })
        .map((u) => ({ id: u.id, name: u.name, email: u.email }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

      return NextResponse.json({ staff });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/hse/staff',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load staff.' }, { status: 500 });
    }
  });
}
