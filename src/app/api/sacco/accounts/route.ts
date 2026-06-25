import { NextRequest, NextResponse } from 'next/server';
import type { SaccoAccountType, SaccoLedgerEntryType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessSacco, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { postLedgerEntry } from '@/lib/sacco/ledger';
import { serializeAccount, serializeLedgerEntry } from '@/lib/sacco/serialize';

const ACCOUNT_TYPES: SaccoAccountType[] = ['shares', 'bosa', 'fosa'];
const ENTRY_TYPES: SaccoLedgerEntryType[] = [
  'contribution',
  'withdrawal',
  'transfer',
  'dividend',
  'interest',
  'adjustment',
];

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessSacco(user)) {
    return forbiddenResponse('SACCO access is restricted to finance and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const accountType = request.nextUrl.searchParams.get('type')?.trim() as SaccoAccountType | undefined;

    const accounts = await prisma.saccoAccount.findMany({
      where: {
        member: { outsourcingClientId: clientId },
        ...(accountType && ACCOUNT_TYPES.includes(accountType) ? { accountType } : {}),
      },
      include: { member: true },
      orderBy: [{ member: { memberNumber: 'asc' } }, { accountType: 'asc' }],
      take: 500,
    });

    return NextResponse.json({ accounts: accounts.map(serializeAccount) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/sacco/accounts',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load accounts.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessSacco(user)) {
    return forbiddenResponse('SACCO access is restricted to finance and admin users.');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const accountId = typeof body.accountId === 'string' ? body.accountId.trim() : '';
  const entryType =
    typeof body.entryType === 'string' && ENTRY_TYPES.includes(body.entryType as SaccoLedgerEntryType)
      ? (body.entryType as SaccoLedgerEntryType)
      : null;
  const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
  const entryDate = typeof body.entryDate === 'string' ? body.entryDate.trim() : '';

  if (!accountId || !entryType || !Number.isFinite(amount) || amount <= 0 || !entryDate) {
    return NextResponse.json(
      { error: 'accountId, entryType, positive amount, and entryDate are required.' },
      { status: 400 },
    );
  }

  try {
    const entry = await prisma.$transaction((tx) =>
      postLedgerEntry(tx, {
        organizationId: user.currentOrgId,
        accountId,
        entryType,
        amount,
        entryDate: new Date(entryDate),
        reference: typeof body.reference === 'string' ? body.reference.trim() : null,
        description: typeof body.description === 'string' ? body.description.trim() : null,
        createdByUserId: user.id,
      }),
    );

    return NextResponse.json({ entry: serializeLedgerEntry(entry) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to post ledger entry.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
