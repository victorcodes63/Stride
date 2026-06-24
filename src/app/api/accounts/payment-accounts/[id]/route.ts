import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { serializePaymentAccount } from '@/lib/payment-accounts';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess || !access.canManageInvoices) {
    return NextResponse.json({ error: 'No permission to manage payment accounts.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    const existing = await prisma.accountsPaymentAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if ('label' in body) {
      const label = str(body.label);
      if (!label) return NextResponse.json({ error: 'label cannot be empty.' }, { status: 400 });
      data.label = label;
    }
    if ('accountName' in body) {
      const accountName = str(body.accountName);
      if (!accountName) {
        return NextResponse.json({ error: 'accountName cannot be empty.' }, { status: 400 });
      }
      data.accountName = accountName;
    }
    if ('bank' in body) {
      const bank = str(body.bank);
      if (!bank) return NextResponse.json({ error: 'bank cannot be empty.' }, { status: 400 });
      data.bank = bank;
    }
    if ('accountNumber' in body) {
      const accountNumber = str(body.accountNumber);
      if (!accountNumber) {
        return NextResponse.json({ error: 'accountNumber cannot be empty.' }, { status: 400 });
      }
      data.accountNumber = accountNumber;
    }
    if ('bankCode' in body) data.bankCode = str(body.bankCode) ?? '';
    if ('branchCode' in body) data.branchCode = str(body.branchCode) ?? '';
    if ('swiftCode' in body) data.swiftCode = str(body.swiftCode) ?? '';
    if ('purposeNotes' in body) data.purposeNotes = str(body.purposeNotes);
    if ('isPayrollOnly' in body) data.isPayrollOnly = body.isPayrollOnly === true;
    if ('isActive' in body) data.isActive = body.isActive !== false;
    if ('sortOrder' in body && typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)) {
      data.sortOrder = Math.round(body.sortOrder);
    }

    const setDefault = 'isDefault' in body && body.isDefault === true;

    const updated = await prisma.$transaction(async (tx) => {
      if (setDefault) {
        await tx.accountsPaymentAccount.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
        data.isDefault = true;
      } else if ('isDefault' in body && body.isDefault === false && existing.isDefault) {
        data.isDefault = false;
      }

      return tx.accountsPaymentAccount.update({
        where: { id },
        data,
      });
    });

    return NextResponse.json({ account: serializePaymentAccount(updated) });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/accounts/payment-accounts/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update payment account.' }, { status: 500 });
  }
}
