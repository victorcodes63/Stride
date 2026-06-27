import { NextRequest, NextResponse } from 'next/server';
import type { SaccoMemberStatus } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessSacco, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { allocateMemberNumber } from '@/lib/sacco/codes';
import { createMemberWithAccounts } from '@/lib/sacco/ledger';
import { serializeMember } from '@/lib/sacco/serialize';
import { withTenant } from '@/lib/tenant-api';

const STATUSES: SaccoMemberStatus[] = ['active', 'dormant', 'withdrawn', 'deceased'];

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessSacco(ctx.staff)) {
      return forbiddenResponse('SACCO access is restricted to finance and admin users.');
    }

    try {
      const members = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
        const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() || '';

        return tx.saccoMember.findMany({
          where: {
            ...ctx.where(),
            outsourcingClientId: clientId,
            ...(status && STATUSES.includes(status as SaccoMemberStatus)
              ? { status: status as SaccoMemberStatus }
              : {}),
            ...(q
              ? {
                  OR: [
                    { memberNumber: { contains: q, mode: 'insensitive' } },
                    { firstName: { contains: q, mode: 'insensitive' } },
                    { lastName: { contains: q, mode: 'insensitive' } },
                    { nationalId: { contains: q, mode: 'insensitive' } },
                  ],
                }
              : {}),
          },
          include: {
            accounts: true,
            employee: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { memberNumber: 'asc' },
          take: 500,
        });
      });

      return NextResponse.json({ members: members.map(serializeMember) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sacco/members',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load members.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessSacco(ctx.staff)) {
      return forbiddenResponse('SACCO access is restricted to finance and admin users.');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    const joinedAt = typeof body.joinedAt === 'string' ? body.joinedAt.trim() : '';
    if (!firstName || !lastName || !joinedAt) {
      return NextResponse.json({ error: 'First name, last name, and join date are required.' }, { status: 400 });
    }

    try {
      const full = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        const memberNumber =
          typeof body.memberNumber === 'string' && body.memberNumber.trim()
            ? body.memberNumber.trim()
            : await allocateMemberNumber(tx, clientId);

        const member = await createMemberWithAccounts(tx, {
          organizationId: ctx.organizationId,
          outsourcingClientId: clientId,
          memberNumber,
          firstName,
          lastName,
          joinedAt: new Date(joinedAt),
          nationalId: typeof body.nationalId === 'string' ? body.nationalId.trim() : null,
          phone: typeof body.phone === 'string' ? body.phone.trim() : null,
          email: typeof body.email === 'string' ? body.email.trim() : null,
          employeeId: typeof body.employeeId === 'string' ? body.employeeId.trim() : null,
          notes: typeof body.notes === 'string' ? body.notes.trim() : null,
        });

        return tx.saccoMember.findFirstOrThrow({
          where: { ...ctx.where(), id: member.id },
          include: { accounts: true, employee: { select: { id: true, firstName: true, lastName: true } } },
        });
      });

      return NextResponse.json({ member: serializeMember(full) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sacco/members',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create member.' }, { status: 500 });
    }
  });
}
