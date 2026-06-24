import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import {
  ensureDefaultPaymentAccounts,
  serializePaymentAccount,
} from '@/lib/payment-accounts';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }

  try {
    await ensureDefaultPaymentAccounts(prisma);
    const activeOnly = ['1', 'true', 'yes'].includes(
      request.nextUrl.searchParams.get('activeOnly')?.toLowerCase() ?? 'false',
    );

    const rows = await prisma.accountsPaymentAccount.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });

    return NextResponse.json({
      accounts: rows.map(serializePaymentAccount),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/payment-accounts',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load payment accounts.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess || !access.canManageInvoices) {
    return NextResponse.json({ error: 'No permission to manage payment accounts.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const label = str(body.label);
  const accountName = str(body.accountName);
  const bank = str(body.bank);
  const accountNumber = str(body.accountNumber);
  if (!label || !accountName || !bank || !accountNumber) {
    return NextResponse.json(
      { error: 'label, accountName, bank, and accountNumber are required.' },
      { status: 400 },
    );
  }

  const isPayrollOnly = body.isPayrollOnly === true;
  const isDefault = body.isDefault === true;
  const isActive = body.isActive !== false;
  const sortOrder =
    typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
      ? Math.round(body.sortOrder)
      : 0;

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.accountsPaymentAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const maxSort = await tx.accountsPaymentAccount.aggregate({ _max: { sortOrder: true } });
      const nextSort = (maxSort._max.sortOrder ?? -1) + 1;

      return tx.accountsPaymentAccount.create({
        data: {
          label,
          accountName,
          bank,
          accountNumber,
          bankCode: str(body.bankCode) ?? '',
          branchCode: str(body.branchCode) ?? '',
          swiftCode: str(body.swiftCode) ?? '',
          purposeNotes: str(body.purposeNotes),
          isPayrollOnly,
          isDefault,
          isActive,
          sortOrder: sortOrder || nextSort,
        },
      });
    });

    return NextResponse.json({ account: serializePaymentAccount(created) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/accounts/payment-accounts',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create payment account.' }, { status: 500 });
  }
}
