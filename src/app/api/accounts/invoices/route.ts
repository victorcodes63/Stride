import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { computeInvoiceVatFromSubtotal } from '@/lib/accounts-invoice-totals';
import { sumCreditTotalsByInvoiceIds } from '@/lib/accounts-credit-note-totals';
import { reportApiError } from '@/lib/monitoring';
import { getOrCreatePrimaryAccountsClient } from '@/lib/primary-accounts-client';
import { requireRecentSensitiveAuth } from '@/lib/admin-security';
import { logAuditEvent } from '@/lib/audit-events';
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

  try {
    let clientId = request.nextUrl.searchParams.get('clientId')?.trim() || undefined;
    if (!clientId) {
      const ac = await getOrCreatePrimaryAccountsClient(prisma, request);
      clientId = ac.id;
    }
    const openOnly = ['1', 'true', 'yes'].includes(
      request.nextUrl.searchParams.get('openOnly')?.toLowerCase() ?? '',
    );
    const withBalance = ['1', 'true', 'yes'].includes(
      request.nextUrl.searchParams.get('withBalance')?.toLowerCase() ?? '',
    );

    // List view: avoid loading every line row (was slow with many invoices × lines). Totals via one groupBy.
    const invoices = await prisma.accountsInvoice.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        ...(openOnly ? { status: { in: ['unpaid', 'partial'] } } : {}),
      },
      select: {
        id: true,
        invoiceNumber: true,
        clientId: true,
        issueDate: true,
        dueDate: true,
        taxDate: true,
        currency: true,
        vatRateBps: true,
        totalOverrideIncVat: true,
        status: true,
        notes: true,
        accountsClient: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: [{ issueDate: 'desc' }, { invoiceNumber: 'desc' }],
      take: 200,
    });

    const ids = invoices.map((i) => i.id);
    const aggregates =
      ids.length === 0
        ? []
        : await prisma.accountsInvoiceLine.groupBy({
            by: ['invoiceId'],
            where: { invoiceId: { in: ids } },
            _sum: { amountExVat: true },
          });

    const subtotalByInvoice = new Map<string, number>();
    for (const row of aggregates) {
      subtotalByInvoice.set(row.invoiceId, Number(row._sum.amountExVat ?? 0));
    }

    const allocatedByInvoice = new Map<string, number>();
    const creditByInvoice = new Map<string, number>();
    if (withBalance && ids.length > 0) {
      const allocRows = await prisma.accountsInvoicePaymentAllocation.groupBy({
        by: ['invoiceId'],
        where: { invoiceId: { in: ids } },
        _sum: { amount: true },
      });
      for (const row of allocRows) {
        allocatedByInvoice.set(row.invoiceId, Number(row._sum.amount ?? 0));
      }
      const creditMap = await sumCreditTotalsByInvoiceIds(prisma, ids);
      creditMap.forEach((v, k) => creditByInvoice.set(k, v));
    }

    const list = invoices.map((inv) => {
      const subtotalExVat = subtotalByInvoice.get(inv.id) ?? 0;
      const { vatAmount, totalIncVat: computedTotalIncVat } = computeInvoiceVatFromSubtotal(
        subtotalExVat,
        inv.vatRateBps,
      );
      const totalIncVat = inv.totalOverrideIncVat != null ? Number(inv.totalOverrideIncVat) : computedTotalIncVat;
      const allocatedTotal = withBalance ? allocatedByInvoice.get(inv.id) ?? 0 : undefined;
      const creditTotal = withBalance ? creditByInvoice.get(inv.id) ?? 0 : undefined;
      const balanceDue =
        withBalance && allocatedTotal !== undefined && creditTotal !== undefined
          ? Math.round((totalIncVat - allocatedTotal - creditTotal) * 100) / 100
          : undefined;
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientId: inv.clientId,
        clientName: inv.accountsClient.name,
        issueDate: inv.issueDate.toISOString().slice(0, 10),
        dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : null,
        taxDate: inv.taxDate ? inv.taxDate.toISOString().slice(0, 10) : null,
        currency: inv.currency,
        vatRateBps: inv.vatRateBps,
        status: inv.status,
        subtotalExVat,
        vatAmount,
        totalIncVat,
        totalOverrideIncVat: inv.totalOverrideIncVat != null ? Number(inv.totalOverrideIncVat) : null,
        lineCount: inv._count.lines,
        notes: inv.notes,
        ...(withBalance
          ? {
              allocatedTotal,
              creditTotal,
              balanceDue,
            }
          : {}),
      };
    });

    return NextResponse.json({ invoices: list });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/invoices',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load invoices.' }, { status: 500 });
  }
}

/** Create invoice; uses global sequential invoiceNumber across all clients. */
export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }
  if (!access.canManageInvoices) {
    return NextResponse.json(
      { error: 'You do not have permission to create invoices.' },
      { status: 403 },
    );
  }
  const reauthError = requireRecentSensitiveAuth(request, user.id);
  if (reauthError) return reauthError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const clientId = str(b.clientId);
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required.' }, { status: 400 });
  }

  const issueDate = parseIsoDateOnly(b.issueDate);
  if (!issueDate) {
    return NextResponse.json(
      { error: 'issueDate is required (YYYY-MM-DD).' },
      { status: 400 },
    );
  }

  const dueDateRaw = b.dueDate;
  const dueDate =
    dueDateRaw === null || dueDateRaw === undefined || dueDateRaw === ''
      ? null
      : parseIsoDateOnly(dueDateRaw);
  if (dueDateRaw !== null && dueDateRaw !== undefined && dueDateRaw !== '' && !dueDate) {
    return NextResponse.json({ error: 'dueDate must be YYYY-MM-DD or empty.' }, { status: 400 });
  }

  const taxDateRaw = b.taxDate;
  const taxDate =
    taxDateRaw === null || taxDateRaw === undefined || taxDateRaw === ''
      ? issueDate
      : parseIsoDateOnly(taxDateRaw);
  if (!taxDate) {
    return NextResponse.json({ error: 'taxDate must be YYYY-MM-DD.' }, { status: 400 });
  }

  let vatRateBps = 1600;
  if (b.vatRateBps !== undefined && b.vatRateBps !== null) {
    const n =
      typeof b.vatRateBps === 'number' ? b.vatRateBps : parseInt(String(b.vatRateBps), 10);
    if (!Number.isFinite(n) || n < 0 || n > 50_000) {
      return NextResponse.json({ error: 'vatRateBps must be between 0 and 50000.' }, { status: 400 });
    }
    vatRateBps = Math.round(n);
  }

  let totalOverrideIncVat: Prisma.Decimal | null | undefined = undefined;
  if ('totalOverrideIncVat' in b) {
    const raw = b.totalOverrideIncVat;
    if (raw === null || raw === undefined || raw === '') {
      totalOverrideIncVat = null;
    } else {
      const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json(
          { error: 'totalOverrideIncVat must be a positive amount or null.' },
          { status: 400 },
        );
      }
      totalOverrideIncVat = new Prisma.Decimal(Math.round(n * 100) / 100);
    }
  }

  const paymentBank =
    typeof b.paymentBank === 'string' && PAYMENT_BANK_VALUES.has(b.paymentBank)
      ? b.paymentBank
      : 'consultancy_fees';
  const paymentAccountIdInput =
    typeof b.paymentAccountId === 'string' ? b.paymentAccountId.trim() || null : null;

  const currencyOverride = str(b.currency);
  const notes = b.notes != null && typeof b.notes === 'string' ? b.notes.trim() || null : null;

  const contractIdOpt = str(b.contractId);

  const linesIn = b.lines;
  if (!Array.isArray(linesIn) || linesIn.length < 1) {
    return NextResponse.json({ error: 'At least one line item is required.' }, { status: 400 });
  }

  const lineCreates: { item: string; description: string | null; amountExVat: Prisma.Decimal; sortOrder: number }[] =
    [];
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
    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.accountsClient.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          currency: true,
        },
      });
      if (!client) {
        throw Object.assign(new Error('CLIENT_NOT_FOUND'), { code: 'CLIENT_NOT_FOUND' });
      }

      if (contractIdOpt) {
        const ctr = await tx.accountsContract.findFirst({
          where: { id: contractIdOpt, clientId },
          select: { id: true },
        });
        if (!ctr) {
          throw Object.assign(new Error('CONTRACT_NOT_FOUND'), { code: 'CONTRACT_NOT_FOUND' });
        }
      }

      const currency = (currencyOverride ?? client.currency ?? 'KES').trim() || 'KES';
      // Global monotonic numbering (all clients share one sequence).
      // Advisory lock avoids race on aggregate(max)+1 under concurrent creates.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242);`;
      const maxInvoiceNumber = await tx.accountsInvoice.aggregate({
        _max: { invoiceNumber: true },
      });
      const invoiceNumber = (maxInvoiceNumber._max.invoiceNumber ?? 0) + 1;

      const paymentAccountId = await resolvePaymentAccountId(tx, {
        paymentAccountId: paymentAccountIdInput,
        paymentBank,
      });
      if (!paymentAccountId) {
        throw Object.assign(new Error('PAYMENT_ACCOUNT_NOT_FOUND'), {
          code: 'PAYMENT_ACCOUNT_NOT_FOUND',
        });
      }
      const resolvedPaymentBank = await paymentBankForAccountId(tx, paymentAccountId);

      const inv = await tx.accountsInvoice.create({
        data: {
          clientId,
          ...(contractIdOpt ? { contractId: contractIdOpt } : {}),
          invoiceNumber,
          issueDate,
          dueDate,
          taxDate,
          currency,
          vatRateBps,
          ...(totalOverrideIncVat !== undefined ? { totalOverrideIncVat } : {}),
          status: 'unpaid',
          notes,
          paymentAccountId,
          paymentBank: resolvedPaymentBank,
          lines: {
            create: lineCreates,
          },
        },
        select: { id: true, invoiceNumber: true },
      });

      return inv;
    });

    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'accounts.invoice.created',
      entityType: 'AccountsInvoice',
      entityId: result.id,
      route: 'POST /api/accounts/invoices',
      metadata: { invoiceNumber: result.invoiceNumber, clientId },
    });
    return NextResponse.json(
      { id: result.id, invoiceNumber: result.invoiceNumber },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'PAYMENT_ACCOUNT_NOT_FOUND') {
      return NextResponse.json({ error: 'Payment account not found or inactive.' }, { status: 400 });
    }
    if (err.code === 'CLIENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Billing client not found.' }, { status: 404 });
    }
    if (err.code === 'CONTRACT_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Contract not found or does not belong to this client.' },
        { status: 400 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          error:
            'Invoice number conflict. Another request may have issued an invoice—refresh and try again.',
        },
        { status: 409 },
      );
    }
    await reportApiError({
      route: 'POST /api/accounts/invoices',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create invoice.' }, { status: 500 });
  }
}
