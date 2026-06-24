import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import { reportApiError } from '@/lib/monitoring';
import { recomputeInvoiceStatusesForInvoiceIds } from '@/lib/accounts-invoice-allocation-status';
import { sumCreditTotalForInvoice } from '@/lib/accounts-credit-note-totals';
import {
  paymentBankForAccountId,
  resolvePaymentAccountId,
} from '@/lib/payment-accounts';

export const dynamic = 'force-dynamic';

const PAYMENT_BANK_VALUES = new Set(['payroll_only', 'consultancy_fees']);

function parseIsoDateOnly(s: unknown): Date | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, mo, d] = t.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

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

  const clientId = request.nextUrl.searchParams.get('clientId')?.trim() || undefined;
  const originalInvoiceId =
    request.nextUrl.searchParams.get('originalInvoiceId')?.trim() || undefined;

  try {
    const notes = await prisma.accountsCreditNote.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        ...(originalInvoiceId ? { originalInvoiceId } : {}),
      },
      select: {
        id: true,
        clientId: true,
        originalInvoiceId: true,
        creditNoteNumber: true,
        issueDate: true,
        currency: true,
        vatRateBps: true,
        totalIncVat: true,
        notes: true,
        client: { select: { name: true } },
        originalInvoice: { select: { invoiceNumber: true } },
      },
      orderBy: [{ issueDate: 'desc' }, { creditNoteNumber: 'desc' }],
      take: 200,
    });

    return NextResponse.json({
      creditNotes: notes.map((n) => ({
        id: n.id,
        clientId: n.clientId,
        clientName: n.client.name,
        originalInvoiceId: n.originalInvoiceId,
        originalInvoiceNumber: n.originalInvoice.invoiceNumber,
        creditNoteNumber: n.creditNoteNumber,
        issueDate: n.issueDate.toISOString().slice(0, 10),
        currency: n.currency,
        vatRateBps: n.vatRateBps,
        totalIncVat: Number(n.totalIncVat),
        notes: n.notes,
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/credit-notes',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load credit notes.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }
  if (!access.canManageInvoices) {
    return NextResponse.json(
      { error: 'You do not have permission to issue credit notes.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const targetInvoiceId = str(b.originalInvoiceId) ?? str(b.invoiceId);

  if (!targetInvoiceId) {
    return NextResponse.json(
      { error: 'originalInvoiceId (or invoiceId) is required.' },
      { status: 400 },
    );
  }

  const issueDate = parseIsoDateOnly(b.issueDate);
  if (!issueDate) {
    return NextResponse.json({ error: 'issueDate is required (YYYY-MM-DD).' }, { status: 400 });
  }

  let vatRateBpsFromBody: number | undefined;
  if (b.vatRateBps !== undefined && b.vatRateBps !== null) {
    const n =
      typeof b.vatRateBps === 'number' ? b.vatRateBps : parseInt(String(b.vatRateBps), 10);
    if (!Number.isFinite(n) || n < 0 || n > 50_000) {
      return NextResponse.json({ error: 'vatRateBps must be between 0 and 50000.' }, { status: 400 });
    }
    vatRateBpsFromBody = Math.round(n);
  }

  const paymentBank =
    typeof b.paymentBank === 'string' && PAYMENT_BANK_VALUES.has(b.paymentBank)
      ? b.paymentBank
      : 'consultancy_fees';
  const paymentAccountIdInput =
    typeof b.paymentAccountId === 'string' ? b.paymentAccountId.trim() || null : null;

  const currencyOverride = str(b.currency);
  const notes = b.notes != null && typeof b.notes === 'string' ? b.notes.trim() || null : null;

  const linesIn = b.lines;
  if (!Array.isArray(linesIn) || linesIn.length < 1) {
    return NextResponse.json({ error: 'At least one line item is required.' }, { status: 400 });
  }

  const lineCreates: {
    item: string;
    description: string | null;
    amountExVat: Prisma.Decimal;
    sortOrder: number;
  }[] = [];

  for (let i = 0; i < linesIn.length; i++) {
    const row = linesIn[i];
    if (!row || typeof row !== 'object') {
      return NextResponse.json({ error: 'Invalid line item.' }, { status: 400 });
    }
    const r = row as Record<string, unknown>;
    const item = typeof r.item === 'string' ? r.item.trim() : '';
    if (!item) {
      return NextResponse.json({ error: 'Each line must have an item description.' }, { status: 400 });
    }
    const amtRaw = r.amountExVat;
    const amt =
      typeof amtRaw === 'number' && Number.isFinite(amtRaw)
        ? amtRaw
        : parseFloat(String(amtRaw ?? ''));
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json(
        { error: 'Each line must have a positive amount (ex-VAT).' },
        { status: 400 },
      );
    }
    const description =
      r.description != null && typeof r.description === 'string' ? r.description.trim() || null : null;
    lineCreates.push({
      item,
      description,
      amountExVat: new Prisma.Decimal(Math.round(amt * 100) / 100),
      sortOrder: i,
    });
  }

  try {
    const createdId = await prisma.$transaction(async (tx) => {
      const inv = await tx.accountsInvoice.findUnique({
        where: { id: targetInvoiceId },
        include: { lines: true, accountsClient: { select: { id: true, currency: true, nextCreditNoteNumber: true } } },
      });
      if (!inv) {
        throw Object.assign(new Error('INVOICE_NOT_FOUND'), { code: 'INVOICE_NOT_FOUND' });
      }

      const paymentAccountId = await resolvePaymentAccountId(tx, {
        paymentAccountId: paymentAccountIdInput ?? inv.paymentAccountId,
        paymentBank: paymentAccountIdInput ? undefined : paymentBank,
      });
      if (!paymentAccountId) {
        throw Object.assign(new Error('PAYMENT_ACCOUNT_NOT_FOUND'), {
          code: 'PAYMENT_ACCOUNT_NOT_FOUND',
        });
      }
      const resolvedPaymentBank = await paymentBankForAccountId(tx, paymentAccountId);

      const { totalIncVat: invoiceTotal } = computeInvoiceVatFromLines(inv.lines, inv.vatRateBps);
      const existingCredit = await sumCreditTotalForInvoice(tx, inv.id);
      const vatRateBps = vatRateBpsFromBody ?? inv.vatRateBps;
      const { totalIncVat: newCreditTotal } = computeInvoiceVatFromLines(
        lineCreates.map((l) => ({ amountExVat: l.amountExVat })),
        vatRateBps,
      );

      const eps = 0.02;
      if (existingCredit + newCreditTotal > invoiceTotal + eps) {
        throw Object.assign(
          new Error(
            `Credit total would exceed invoice amount. Invoice total (incl. VAT) ${invoiceTotal.toFixed(2)}; already credited ${existingCredit.toFixed(2)}; this note ${newCreditTotal.toFixed(2)}.`,
          ),
          { code: 'CREDIT_CAP' },
        );
      }

      const currency = (currencyOverride ?? inv.currency ?? inv.accountsClient.currency ?? 'KES').trim() || 'KES';
      const creditNoteNumber = inv.accountsClient.nextCreditNoteNumber;

      const cn = await tx.accountsCreditNote.create({
        data: {
          clientId: inv.clientId,
          originalInvoiceId: inv.id,
          creditNoteNumber,
          issueDate,
          currency,
          vatRateBps,
          totalIncVat: new Prisma.Decimal(Math.round(newCreditTotal * 100) / 100),
          paymentBank: resolvedPaymentBank,
          paymentAccountId,
          notes,
          lines: { create: lineCreates },
        },
        select: { id: true },
      });

      await tx.accountsClient.update({
        where: { id: inv.clientId },
        data: { nextCreditNoteNumber: creditNoteNumber + 1 },
      });

      await recomputeInvoiceStatusesForInvoiceIds(tx, [inv.id]);
      return cn.id;
    });

    return NextResponse.json({ id: createdId }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'PAYMENT_ACCOUNT_NOT_FOUND') {
      return NextResponse.json({ error: 'Payment account not found or inactive.' }, { status: 400 });
    }
    if (err.code === 'INVOICE_NOT_FOUND') {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }
    if (err.code === 'CREDIT_CAP') {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Credit too large.' },
        { status: 400 },
      );
    }
    await reportApiError({
      route: 'POST /api/accounts/credit-notes',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create credit note.' }, { status: 500 });
  }
}
