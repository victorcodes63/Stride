import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import { reportApiError } from '@/lib/monitoring';
import { recomputeInvoiceStatusesForInvoiceIds } from '@/lib/accounts-invoice-allocation-status';
import { sumCreditTotalForInvoice } from '@/lib/accounts-credit-note-totals';

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

  try {
    const payments = await prisma.accountsClientPayment.findMany({
      where: clientId ? { clientId } : {},
      orderBy: { receivedAt: 'desc' },
      take: 150,
      include: {
        client: { select: { id: true, name: true, currency: true } },
        allocations: {
          include: {
            invoice: {
              select: { id: true, invoiceNumber: true, currency: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      canManagePayments: access.canManagePayments,
      payments: payments.map((p) => ({
        id: p.id,
        clientId: p.clientId,
        clientName: p.client.name,
        clientCurrency: p.client.currency,
        receivedAt: p.receivedAt.toISOString().slice(0, 10),
        amount: Number(p.amount),
        reference: p.reference,
        method: p.method,
        notes: p.notes,
        createdAt: p.createdAt.toISOString(),
        allocations: p.allocations.map((a) => ({
          id: a.id,
          invoiceId: a.invoiceId,
          invoiceNumber: a.invoice.invoiceNumber,
          amount: Number(a.amount),
        })),
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/client-payments',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load receipts.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }
  if (!access.canManagePayments) {
    return NextResponse.json(
      { error: 'You do not have permission to record client receipts.' },
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
  const clientId = str(b.clientId);
  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required.' }, { status: 400 });
  }

  const receivedAt = parseIsoDateOnly(b.receivedAt);
  if (!receivedAt) {
    return NextResponse.json({ error: 'receivedAt is required (YYYY-MM-DD).' }, { status: 400 });
  }

  const amountRaw = b.amount;
  const amountNum =
    typeof amountRaw === 'number' && Number.isFinite(amountRaw)
      ? amountRaw
      : parseFloat(String(amountRaw ?? ''));
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number.' }, { status: 400 });
  }
  const amount = Math.round(amountNum * 100) / 100;

  const reference = str(b.reference);
  const method = str(b.method);
  const notes = b.notes != null && typeof b.notes === 'string' ? b.notes.trim() || null : null;

  const allocationsIn = b.allocations;
  if (!Array.isArray(allocationsIn) || allocationsIn.length < 1) {
    return NextResponse.json(
      { error: 'allocations is required: [{ invoiceId, amount }, ...]' },
      { status: 400 },
    );
  }

  const allocationRows: { invoiceId: string; amt: number }[] = [];
  for (const row of allocationsIn) {
    if (!row || typeof row !== 'object') {
      return NextResponse.json({ error: 'Invalid allocation.' }, { status: 400 });
    }
    const r = row as Record<string, unknown>;
    const invoiceId = str(r.invoiceId);
    if (!invoiceId) return NextResponse.json({ error: 'Each allocation needs invoiceId.' }, { status: 400 });
    const aRaw = r.amount;
    const a =
      typeof aRaw === 'number' && Number.isFinite(aRaw) ? aRaw : parseFloat(String(aRaw ?? ''));
    if (!Number.isFinite(a) || a <= 0) {
      return NextResponse.json({ error: 'Each allocation amount must be positive.' }, { status: 400 });
    }
    allocationRows.push({ invoiceId, amt: Math.round(a * 100) / 100 });
  }

  const allocSum = allocationRows.reduce((s, x) => s + x.amt, 0);
  if (Math.abs(allocSum - amount) > 0.02) {
    return NextResponse.json(
      { error: `Allocation total (${allocSum}) must equal receipt amount (${amount}).` },
      { status: 400 },
    );
  }

  const newByInvoice = new Map<string, number>();
  for (const row of allocationRows) {
    newByInvoice.set(row.invoiceId, (newByInvoice.get(row.invoiceId) ?? 0) + row.amt);
  }

  try {
    const paymentId = await prisma.$transaction(async (tx) => {
      const client = await tx.accountsClient.findUnique({
        where: { id: clientId },
        select: { id: true },
      });
      if (!client) {
        throw Object.assign(new Error('CLIENT_NOT_FOUND'), { code: 'CLIENT_NOT_FOUND' });
      }

      const invoiceIds = [...newByInvoice.keys()];
      const invoices = await tx.accountsInvoice.findMany({
        where: { id: { in: invoiceIds }, clientId },
        include: {
          lines: true,
          allocations: true,
        },
      });

      if (invoices.length !== invoiceIds.length) {
        throw Object.assign(new Error('INVOICE_MISMATCH'), { code: 'INVOICE_MISMATCH' });
      }

      const eps = 0.02;
      for (const inv of invoices) {
        const { totalIncVat } = computeInvoiceVatFromLines(inv.lines, inv.vatRateBps);
        const already = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
        const credited = await sumCreditTotalForInvoice(tx, inv.id);
        const add = newByInvoice.get(inv.id) ?? 0;
        const capacity = totalIncVat - already - credited;
        if (add > capacity + eps) {
          throw Object.assign(
            new Error(
              `Allocation for invoice #${inv.invoiceNumber} exceeds balance (due ${Math.max(0, capacity).toFixed(2)}).`,
            ),
            { code: 'OVERALLOC' },
          );
        }
      }

      const payment = await tx.accountsClientPayment.create({
        data: {
          clientId,
          receivedAt,
          amount: new Prisma.Decimal(amount),
          reference,
          method,
          notes,
          allocations: {
            create: allocationRows.map((x) => ({
              invoiceId: x.invoiceId,
              amount: new Prisma.Decimal(x.amt),
            })),
          },
        },
        select: { id: true },
      });

      await recomputeInvoiceStatusesForInvoiceIds(tx, invoiceIds);
      return payment.id;
    });

    return NextResponse.json({ id: paymentId }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'CLIENT_NOT_FOUND') {
      return NextResponse.json({ error: 'Billing client not found.' }, { status: 404 });
    }
    if (err.code === 'INVOICE_MISMATCH') {
      return NextResponse.json(
        { error: 'One or more invoices were not found or do not belong to this client.' },
        { status: 400 },
      );
    }
    if (err.code === 'OVERALLOC') {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Over-allocation.' },
        { status: 400 },
      );
    }
    await reportApiError({
      route: 'POST /api/accounts/client-payments',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to record receipt.' }, { status: 500 });
  }
}
