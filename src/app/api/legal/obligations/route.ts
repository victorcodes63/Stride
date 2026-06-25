import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { buildObligationRegister } from '@/lib/legal/obligations';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(prisma, request);
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const [contracts, credentials] = await Promise.all([
    prisma.accountsContract.findMany({
      where: { clientId: primaryAccountsClient.id },
      include: { managers: { include: { user: { select: { name: true } } } } },
      orderBy: { endDate: 'asc' },
    }),
    prisma.employeeCredential.findMany({
      where: {
        employee: { outsourcingClientId: workspaceClientId },
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
}
