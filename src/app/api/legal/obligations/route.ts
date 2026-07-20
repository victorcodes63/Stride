import { NextRequest, NextResponse } from 'next/server';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { buildObligationRegister } from '@/lib/legal/obligations';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const [contracts, credentials, policies, compliance] = await ctx.run(async (tx) => {
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
        tx.companyDocument.findMany({
          where: {
            ...ctx.where(),
            status: { not: 'archived' },
            expiryDate: { not: null },
          },
          select: {
            id: true,
            title: true,
            category: true,
            expiryDate: true,
          },
          orderBy: { expiryDate: 'asc' },
          take: 200,
        }),
        tx.legalObligation.findMany({
          where: ctx.where(),
          include: {
            owner: { select: { name: true } },
          },
          orderBy: { dueDate: 'asc' },
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
      policies: policies
        .filter((p) => p.expiryDate)
        .map((p) => ({
          id: p.id,
          title: p.title,
          category: p.category,
          expiryDate: p.expiryDate!,
        })),
      compliance: compliance.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        dueDate: c.dueDate,
        status: c.status,
        regulator: c.regulator,
        owner: c.owner,
      })),
    });

    return NextResponse.json({
      obligations,
      summary: {
        total: obligations.length,
        overdue: obligations.filter((o) => o.status === 'overdue').length,
        dueSoon: obligations.filter((o) => o.status === 'due_soon').length,
        completed: obligations.filter((o) => o.status === 'completed').length,
      },
    });
  });
}
