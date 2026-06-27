import { NextRequest, NextResponse } from 'next/server';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { buildObligationRegister } from '@/lib/legal/obligations';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const [contracts, credentials] = await ctx.run(async (tx) => {
      const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(
        tx,
        ctx.organizationId,
        request,
      );
      const workspaceClientId = await resolvePrimaryWorkspaceClientId(
        tx,
        null,
        request,
        ctx.organizationId,
      );

      return Promise.all([
        tx.accountsContract.findMany({
          where: {
            ...ctx.where(),
            clientId: primaryAccountsClient.id,
          },
          include: { managers: { include: { user: { select: { name: true } } } } },
          orderBy: { endDate: 'asc' },
        }),
        tx.employeeCredential.findMany({
          where: {
            ...ctx.where(),
            employee: {
              outsourcingClientId: workspaceClientId,
              organizationId: ctx.organizationId,
            },
            expiryDate: { not: null },
            status: { in: ['active', 'expiring_soon', 'expired'] },
          },
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
          orderBy: { expiryDate: 'asc' },
          take: 200,
        }),
      ]);
    });

    const obligations = buildObligationRegister({
      contracts: contracts.map((c) => ({
        id: c.id,
        title: c.title,
        reference: c.reference,
        endDate: c.endDate,
        managers: c.managers.map((m) => ({ name: m.user.name })),
      })),
      credentials,
    });

    return NextResponse.json({
      obligations,
      summary: {
        total: obligations.length,
        overdue: obligations.filter((o) => o.status === 'overdue').length,
        dueSoon: obligations.filter((o) => o.status === 'due_soon').length,
      },
    });
  });
}
