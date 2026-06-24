import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';

function parseContractType(reference: string | null) {
  const r = (reference || '').toUpperCase();
  if (r.startsWith('CONS-')) return 'consultant';
  return 'employee';
}

function normalizeReference(reference: string, type: 'employee' | 'consultant') {
  const trimmed = reference.trim();
  if (!trimmed) return '';
  const prefixed = type === 'consultant' ? 'CONS-' : 'EMP-';
  if (trimmed.toUpperCase().startsWith(prefixed)) return trimmed;
  return `${prefixed}${trimmed}`;
}

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.DATABASE_URL) {
    return NextResponse.json([], { status: 200 });
  }

  const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(prisma, request);
  const rows = await prisma.accountsContract.findMany({
    where: { clientId: primaryAccountsClient.id },
    include: {
      managers: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json(
    rows.map((c) => ({
      id: c.id,
      title: c.title,
      reference: c.reference,
      contractType: parseContractType(c.reference),
      startDate: c.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: c.endDate.toISOString().slice(0, 10),
      remindersDisabled: c.remindersDisabled,
      managers: c.managers.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
      })),
      createdAt: c.createdAt.toISOString(),
    })),
  );
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const contractType = body.contractType === 'consultant' ? 'consultant' : 'employee';
  const partyName = String(body.partyName || '').trim();
  const referenceInput = String(body.reference || '').trim();
  const reference = normalizeReference(referenceInput, contractType) || null;
  const startDateRaw = String(body.startDate || '').trim();
  const endDateRaw = String(body.endDate || '').trim();
  const remindersDisabled = body.remindersDisabled === true;
  const managerIdsInput = Array.isArray(body.managerIds)
    ? body.managerIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];

  if (!partyName || !endDateRaw) {
    return NextResponse.json({ error: 'partyName and endDate are required.' }, { status: 400 });
  }

  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const endDate = new Date(endDateRaw);
  if ((startDate && Number.isNaN(startDate.getTime())) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date values.' }, { status: 400 });
  }
  if (startDate && startDate > endDate) {
    return NextResponse.json({ error: 'startDate cannot be after endDate.' }, { status: 400 });
  }

  const primaryAccountsClient = await getOrCreatePrimaryAccountsClient(prisma, request);
  const managerIds = [...new Set([user.id, ...managerIdsInput])];

  const created = await prisma.accountsContract.create({
    data: {
      clientId: primaryAccountsClient.id,
      title: partyName,
      reference,
      startDate: startDate ?? null,
      endDate,
      remindersDisabled,
      managers: {
        create: managerIds.map((userId) => ({ userId })),
      },
    },
    include: {
      managers: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      title: created.title,
      reference: created.reference,
      contractType: parseContractType(created.reference),
      startDate: created.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: created.endDate.toISOString().slice(0, 10),
      remindersDisabled: created.remindersDisabled,
      managers: created.managers.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
      })),
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 },
  );
}

