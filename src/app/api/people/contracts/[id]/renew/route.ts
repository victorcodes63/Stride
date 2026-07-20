import { NextRequest, NextResponse } from 'next/server';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

function addMonths(isoDate: string, months: number) {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    const body = (await request.json().catch(() => ({}))) as {
      newEndDate?: string;
      newStartDate?: string;
      reference?: string;
    };

    try {
      const renewed = await ctx.run(async (tx) => {
        const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(
          tx,
          ctx.organizationId,
          request,
        );
        const existing = await tx.accountsContract.findFirst({
          where: { ...ctx.where(), id, clientId: primaryAccountsClient.id },
          include: {
            managers: { select: { userId: true } },
          },
        });
        if (!existing) return null;

        const newStartDateIso =
          typeof body.newStartDate === 'string' && body.newStartDate.trim()
            ? body.newStartDate.trim()
            : existing.endDate.toISOString().slice(0, 10);
        const newEndDateIso =
          typeof body.newEndDate === 'string' && body.newEndDate.trim()
            ? body.newEndDate.trim()
            : addMonths(existing.endDate.toISOString().slice(0, 10), 12);

        const newStartDate = new Date(newStartDateIso);
        const newEndDate = new Date(newEndDateIso);
        if (Number.isNaN(newStartDate.getTime()) || Number.isNaN(newEndDate.getTime())) {
          throw new Error('Invalid renewal dates.');
        }
        if (newStartDate > newEndDate) {
          throw new Error('newStartDate cannot be after newEndDate.');
        }

        const managerIds = [...new Set([ctx.staff.id, ...existing.managers.map((m) => m.userId)])];
        const reference =
          typeof body.reference === 'string' && body.reference.trim()
            ? body.reference.trim()
            : existing.reference;

        return tx.accountsContract.create({
          data: {
            organizationId: ctx.organizationId,
            clientId: existing.clientId,
            title: existing.title,
            reference,
            startDate: newStartDate,
            endDate: newEndDate,
            remindersDisabled: false,
            managers: {
              create: managerIds.map((userId) => ({
                organizationId: ctx.organizationId,
                userId,
              })),
            },
          },
        });
      });

      if (!renewed) {
        return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
      }

      await ctx.audit({
        action: 'contract.renewed',
        entityType: 'AccountsContract',
        entityId: renewed.id,
        route: 'POST /api/people/contracts/[id]/renew',
        metadata: { previousContractId: id },
      });

      return NextResponse.json(
        {
          id: renewed.id,
          startDate: renewed.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: renewed.endDate.toISOString().slice(0, 10),
        },
        { status: 201 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Invalid renewal') || message.includes('newStartDate')) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      await reportApiError({
        route: 'POST /api/people/contracts/[id]/renew',
        message,
      });
      return NextResponse.json({ error: 'Failed to renew contract.' }, { status: 500 });
    }
  });
}
