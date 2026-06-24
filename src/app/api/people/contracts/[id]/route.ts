import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';

function parseContractType(reference: string | null) {
  const r = (reference || '').toUpperCase();
  if (r.startsWith('CONS-')) return 'consultant';
  return 'employee';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(prisma, request);

  const row = await prisma.accountsContract.findFirst({
    where: { id, clientId: primaryAccountsClient.id },
    include: {
      managers: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!row) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  return NextResponse.json({
    id: row.id,
    title: row.title,
    reference: row.reference,
    contractType: parseContractType(row.reference),
    startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: row.endDate.toISOString().slice(0, 10),
    remindersDisabled: row.remindersDisabled,
    managers: row.managers.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
    })),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { remindersDisabled?: boolean; managerIds?: string[] }
    | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(prisma, request);
  const existing = await prisma.accountsContract.findFirst({
    where: { id, clientId: primaryAccountsClient.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  const managerIds = Array.isArray(body.managerIds)
    ? [...new Set(body.managerIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0))]
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.accountsContract.update({
      where: { id },
      data: {
        ...(typeof body.remindersDisabled === 'boolean'
          ? { remindersDisabled: body.remindersDisabled }
          : {}),
      },
    });
    if (managerIds) {
      await tx.contractManager.deleteMany({ where: { contractId: id } });
      const finalIds = [...new Set([user.id, ...managerIds])];
      if (finalIds.length) {
        await tx.contractManager.createMany({
          data: finalIds.map((userId) => ({ contractId: id, userId })),
          skipDuplicates: true,
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

