import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';

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
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as {
    newEndDate?: string;
    newStartDate?: string;
    reference?: string;
  };

  const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(prisma, request);
  const existing = await prisma.accountsContract.findFirst({
    where: { id, clientId: primaryAccountsClient.id },
    include: {
      managers: { select: { userId: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

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
    return NextResponse.json({ error: 'Invalid renewal dates.' }, { status: 400 });
  }
  if (newStartDate > newEndDate) {
    return NextResponse.json({ error: 'newStartDate cannot be after newEndDate.' }, { status: 400 });
  }

  const managerIds = [...new Set([user.id, ...existing.managers.map((m) => m.userId)])];
  const reference =
    typeof body.reference === 'string' && body.reference.trim()
      ? body.reference.trim()
      : existing.reference;

  const renewed = await prisma.accountsContract.create({
    data: {
      clientId: existing.clientId,
      title: existing.title,
      reference,
      startDate: newStartDate,
      endDate: newEndDate,
      remindersDisabled: false,
      managers: {
        create: managerIds.map((userId) => ({ userId })),
      },
    },
  });

  return NextResponse.json(
    {
      id: renewed.id,
      startDate: renewed.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: renewed.endDate.toISOString().slice(0, 10),
    },
    { status: 201 },
  );
}

