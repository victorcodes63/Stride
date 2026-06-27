import { NextRequest, NextResponse } from 'next/server';
import type { SaccoMemberStatus } from '@prisma/client';
import { canAccessSacco, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { serializeLedgerEntry, serializeMember } from '@/lib/sacco/serialize';
import { withTenant } from '@/lib/tenant-api';

const STATUSES: SaccoMemberStatus[] = ['active', 'dormant', 'withdrawn', 'deceased'];

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessSacco(ctx.staff)) {
      return forbiddenResponse('SACCO access is restricted to finance and admin users.');
    }

    const { id } = await context.params;

    try {
      const member = await ctx.run((tx) =>
        tx.saccoMember.findFirst({
          where: { ...ctx.where(), id },
          include: {
            accounts: { include: { entries: { orderBy: { entryDate: 'desc' }, take: 50 } } },
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
      );
      if (!member) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

      return NextResponse.json({
        member: serializeMember(member),
        ledger: member.accounts.flatMap((account) =>
          account.entries.map((entry) => ({
            ...serializeLedgerEntry(entry),
            accountType: account.accountType,
          })),
        ),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sacco/members/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load member.' }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessSacco(ctx.staff)) {
      return forbiddenResponse('SACCO access is restricted to finance and admin users.');
    }

    const { id } = await context.params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.firstName === 'string') data.firstName = body.firstName.trim();
    if (typeof body.lastName === 'string') data.lastName = body.lastName.trim();
    if (typeof body.phone === 'string') data.phone = body.phone.trim() || null;
    if (typeof body.email === 'string') data.email = body.email.trim() || null;
    if (typeof body.notes === 'string') data.notes = body.notes.trim() || null;
    if (
      typeof body.status === 'string' &&
      STATUSES.includes(body.status as SaccoMemberStatus)
    ) {
      data.status = body.status;
    }

    try {
      const updated = await ctx.run((tx) =>
        tx.saccoMember.update({
          where: { id, organizationId: ctx.organizationId },
          data,
          include: {
            accounts: true,
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
      );
      return NextResponse.json({ member: serializeMember(updated) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/sacco/members/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update member.' }, { status: 500 });
    }
  });
}
