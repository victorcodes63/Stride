import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import { sumCreditTotalForInvoice } from '@/lib/accounts-credit-note-totals';
import { reportApiError } from '@/lib/monitoring';
import {
  paymentBankForAccountId,
  resolvePaymentAccountId,
} from '@/lib/payment-accounts';

export const dynamic = 'force-dynamic';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const inv = await prisma.accountsInvoice.findUnique({
      where: { id },
      include: {
        accountsClient: { select: { id: true, name: true, currency: true } },
        contract: {
          select: {
            id: true,
            title: true,
            reference: true,
            startDate: true,
            endDate: true,
          },
        },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const { subtotalExVat, vatAmount, totalIncVat: computedTotalIncVat } = computeInvoiceVatFromLines(
      inv.lines,
      inv.vatRateBps,
    );
    const totalIncVat =
      inv.totalOverrideIncVat != null ? Number(inv.totalOverrideIncVat) : computedTotalIncVat;

    const creditNoteRows = await prisma.accountsCreditNote.findMany({
      where: { originalInvoiceId: id },
      select: {
        id: true,
        creditNoteNumber: true,
        issueDate: true,
        totalIncVat: true,
      },
      orderBy: { issueDate: 'desc' },
    });
    const creditTotalApplied = await sumCreditTotalForInvoice(prisma, id);
    const remainingCreditable = Math.round((totalIncVat - creditTotalApplied) * 100) / 100;

    const canSetInvoiceStatus = access.canManageInvoices || access.canManagePayments;
    const canIssueCreditNote =
      access.canManageInvoices && remainingCreditable > 0.005;

    return NextResponse.json({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      clientName: inv.accountsClient.name,
      contractId: inv.contractId,
      contract: inv.contract
        ? {
            id: inv.contract.id,
            title: inv.contract.title,
            reference: inv.contract.reference,
            startDate: inv.contract.startDate
              ? inv.contract.startDate.toISOString().slice(0, 10)
              : null,
            endDate: inv.contract.endDate.toISOString().slice(0, 10),
          }
        : null,
      issueDate: inv.issueDate.toISOString().slice(0, 10),
      dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : null,
      taxDate: inv.taxDate ? inv.taxDate.toISOString().slice(0, 10) : null,
      currency: inv.currency,
      vatRateBps: inv.vatRateBps,
      totalOverrideIncVat: inv.totalOverrideIncVat != null ? Number(inv.totalOverrideIncVat) : null,
      status: inv.status,
      paymentBank: inv.paymentBank,
      paymentAccountId: inv.paymentAccountId,
      notes: inv.notes,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      subtotalExVat,
      vatAmount,
      totalIncVat,
      lines: inv.lines.map((l, i) => ({
        id: l.id,
        item: l.item,
        description: l.description,
        amountExVat: String(l.amountExVat),
        sortOrder: l.sortOrder,
        lineNo: i + 1,
      })),
      canSetInvoiceStatus,
      canEditInvoice: access.canManageInvoices,
      canIssueCreditNote,
      creditTotalApplied,
      remainingCreditable,
      creditNotes: creditNoteRows.map((c) => ({
        id: c.id,
        creditNoteNumber: c.creditNoteNumber,
        issueDate: c.issueDate.toISOString().slice(0, 10),
        totalIncVat: Number(c.totalIncVat),
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/invoices/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load invoice.' }, { status: 500 });
  }
}

const PAYMENT_BANK_VALUES = new Set(['payroll_only', 'consultancy_fees']);
const INVOICE_STATUS_VALUES = new Set(['unpaid', 'partial', 'paid']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const paymentBank =
    body && typeof body === 'object' && 'paymentBank' in body
      ? (body as { paymentBank: unknown }).paymentBank
      : undefined;

  const statusRaw =
    body && typeof body === 'object' && 'status' in body
      ? (body as { status: unknown }).status
      : undefined;

  const paymentAccountIdRaw =
    body && typeof body === 'object' && 'paymentAccountId' in body
      ? (body as { paymentAccountId: unknown }).paymentAccountId
      : undefined;

  const hasPaymentBank = typeof paymentBank === 'string' && PAYMENT_BANK_VALUES.has(paymentBank);
  const hasPaymentAccountId =
    typeof paymentAccountIdRaw === 'string' && paymentAccountIdRaw.trim().length > 0;
  const hasStatus = typeof statusRaw === 'string' && INVOICE_STATUS_VALUES.has(statusRaw);

  const hasIssueDate = 'issueDate' in payload;
  const hasDueDate = 'dueDate' in payload;
  const hasTaxDate = 'taxDate' in payload;
  const hasVatRateBps = 'vatRateBps' in payload;
  const hasTotalOverrideIncVat = 'totalOverrideIncVat' in payload;
  const hasNotes = 'notes' in payload;
  const hasLines = 'lines' in payload;
  const hasEditFields =
    hasIssueDate ||
    hasDueDate ||
    hasTaxDate ||
    hasVatRateBps ||
    hasTotalOverrideIncVat ||
    hasNotes ||
    hasLines;

  if (!hasPaymentBank && !hasPaymentAccountId && !hasStatus && !hasEditFields) {
    return NextResponse.json(
      {
        error:
          'Send paymentAccountId, paymentBank, status, and/or editable invoice fields (issueDate, dueDate, taxDate, vatRateBps, totalOverrideIncVat, notes, lines).',
      },
      { status: 400 },
    );
  }

  if (hasStatus && !access.canManageInvoices && !access.canManagePayments) {
    return NextResponse.json(
      { error: 'You do not have permission to change invoice payment status.' },
      { status: 403 },
    );
  }
  if (hasEditFields && !access.canManageInvoices) {
    return NextResponse.json(
      { error: 'You do not have permission to edit invoice details.' },
      { status: 403 },
    );
  }

  const data: {
    paymentBank?: 'payroll_only' | 'consultancy_fees';
    paymentAccountId?: string | null;
    status?: 'unpaid' | 'partial' | 'paid';
    issueDate?: Date;
    dueDate?: Date | null;
    taxDate?: Date | null;
    vatRateBps?: number;
    totalOverrideIncVat?: number | null;
    notes?: string | null;
  } = {};
  if (hasPaymentAccountId) {
    const resolvedId = await resolvePaymentAccountId(prisma, {
      paymentAccountId: paymentAccountIdRaw as string,
    });
    if (!resolvedId) {
      return NextResponse.json({ error: 'Payment account not found or inactive.' }, { status: 400 });
    }
    data.paymentAccountId = resolvedId;
    data.paymentBank = await paymentBankForAccountId(prisma, resolvedId);
  } else if (hasPaymentBank) {
    const resolvedId = await resolvePaymentAccountId(prisma, {
      paymentBank: paymentBank as 'payroll_only' | 'consultancy_fees',
    });
    data.paymentBank = paymentBank as 'payroll_only' | 'consultancy_fees';
    if (resolvedId) data.paymentAccountId = resolvedId;
  }
  if (hasStatus) {
    data.status = statusRaw as 'unpaid' | 'partial' | 'paid';
  }
  if (hasIssueDate) {
    const issueDate = parseIsoDateOnly(payload.issueDate);
    if (!issueDate) {
      return NextResponse.json({ error: 'issueDate must be YYYY-MM-DD.' }, { status: 400 });
    }
    data.issueDate = issueDate;
  }
  if (hasDueDate) {
    const raw = payload.dueDate;
    if (raw === null || raw === undefined || raw === '') data.dueDate = null;
    else {
      const dueDate = parseIsoDateOnly(raw);
      if (!dueDate) {
        return NextResponse.json({ error: 'dueDate must be YYYY-MM-DD or empty.' }, { status: 400 });
      }
      data.dueDate = dueDate;
    }
  }
  if (hasTaxDate) {
    const raw = payload.taxDate;
    if (raw === null || raw === undefined || raw === '') data.taxDate = null;
    else {
      const taxDate = parseIsoDateOnly(raw);
      if (!taxDate) {
        return NextResponse.json({ error: 'taxDate must be YYYY-MM-DD or empty.' }, { status: 400 });
      }
      data.taxDate = taxDate;
    }
  }
  if (hasVatRateBps) {
    const n = typeof payload.vatRateBps === 'number' ? payload.vatRateBps : parseInt(String(payload.vatRateBps), 10);
    if (!Number.isFinite(n) || n < 0 || n > 50000) {
      return NextResponse.json({ error: 'vatRateBps must be between 0 and 50000.' }, { status: 400 });
    }
    data.vatRateBps = Math.round(n);
  }
  if (hasTotalOverrideIncVat) {
    const raw = payload.totalOverrideIncVat;
    if (raw === null || raw === undefined || raw === '') {
      data.totalOverrideIncVat = null;
    } else {
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json(
          { error: 'totalOverrideIncVat must be a positive amount or null.' },
          { status: 400 },
        );
      }
      data.totalOverrideIncVat = Math.round(n * 100) / 100;
    }
  }
  if (hasNotes) {
    data.notes =
      payload.notes != null && typeof payload.notes === 'string'
        ? payload.notes.trim() || null
        : null;
  }

  const lineCreates: { item: string; description: string | null; amountExVat: string; sortOrder: number }[] = [];
  if (hasLines) {
    if (!Array.isArray(payload.lines) || payload.lines.length < 1) {
      return NextResponse.json({ error: 'At least one line item is required.' }, { status: 400 });
    }
    for (let i = 0; i < payload.lines.length; i++) {
      const row = payload.lines[i];
      if (!row || typeof row !== 'object') {
        return NextResponse.json({ error: 'Invalid line item.' }, { status: 400 });
      }
      const r = row as Record<string, unknown>;
      const item = typeof r.item === 'string' ? r.item.trim() : '';
      if (!item) {
        return NextResponse.json({ error: 'Each line must have an item description.' }, { status: 400 });
      }
      const amtRaw = r.amountExVat;
      const amt = typeof amtRaw === 'number' ? amtRaw : parseFloat(String(amtRaw ?? ''));
      if (!Number.isFinite(amt) || amt <= 0) {
        return NextResponse.json({ error: 'Each line must have a positive amount (ex-VAT).' }, { status: 400 });
      }
      lineCreates.push({
        item,
        description: typeof r.description === 'string' ? r.description.trim() || null : null,
        amountExVat: (Math.round(amt * 100) / 100).toFixed(2),
        sortOrder: i,
      });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.accountsInvoice.update({
        where: { id },
        data,
      });
      if (hasLines) {
        await tx.accountsInvoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.accountsInvoiceLine.createMany({
          data: lineCreates.map((l) => ({
            invoiceId: id,
            item: l.item,
            description: l.description,
            amountExVat: l.amountExVat,
            sortOrder: l.sortOrder,
          })),
        });
      }
    });
  } catch {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    ...(hasPaymentAccountId || hasPaymentBank
      ? { paymentAccountId: data.paymentAccountId, paymentBank: data.paymentBank }
      : {}),
    ...(hasStatus ? { status: statusRaw } : {}),
    ...(hasEditFields ? { updated: true } : {}),
  });
}
