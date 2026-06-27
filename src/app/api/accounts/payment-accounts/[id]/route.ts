import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
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
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  return withAccountsTenant(request, async (ctx) => {
    const access = await getAccountsAccess(ctx.staff.id, ctx.staff.role);
    if (!access.canManageInvoices) {
      return NextResponse.json({ error: 'No permission to manage payment accounts.' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    try {
      const updated = await ctx.run(async (tx) => {
        const existing = await tx.accountsPaymentAccount.findFirst({
          where: ctx.where({ id }),
        });
        if (!existing) {
          throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
        }

        const data: Record<string, unknown> = {};
        if ('label' in body) {
          const label = str(body.label);
          if (!label) throw Object.assign(new Error('BAD_LABEL'), { code: 'BAD_LABEL' });
          data.label = label;
        }
        if ('accountName' in body) {
          const accountName = str(body.accountName);
          if (!accountName) throw Object.assign(new Error('BAD_ACCOUNT_NAME'), { code: 'BAD_ACCOUNT_NAME' });
          data.accountName = accountName;
        }
        if ('bank' in body) {
          const bank = str(body.bank);
          if (!bank) throw Object.assign(new Error('BAD_BANK'), { code: 'BAD_BANK' });
          data.bank = bank;
        }
        if ('accountNumber' in body) {
          const accountNumber = str(body.accountNumber);
          if (!accountNumber) {
            throw Object.assign(new Error('BAD_ACCOUNT_NUMBER'), { code: 'BAD_ACCOUNT_NUMBER' });
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

        if (setDefault) {
          await tx.accountsPaymentAccount.updateMany({
            where: ctx.where({ isDefault: true, id: { not: id } }),
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
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Payment account not found.' }, { status: 404 });
      }
      if (err.code === 'BAD_LABEL') {
        return NextResponse.json({ error: 'label cannot be empty.' }, { status: 400 });
      }
      if (err.code === 'BAD_ACCOUNT_NAME') {
        return NextResponse.json({ error: 'accountName cannot be empty.' }, { status: 400 });
      }
      if (err.code === 'BAD_BANK') {
        return NextResponse.json({ error: 'bank cannot be empty.' }, { status: 400 });
      }
      if (err.code === 'BAD_ACCOUNT_NUMBER') {
        return NextResponse.json({ error: 'accountNumber cannot be empty.' }, { status: 400 });
      }
      await reportApiError({
        route: 'PATCH /api/accounts/payment-accounts/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update payment account.' }, { status: 500 });
    }
  });
}
