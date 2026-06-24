import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import { reportApiError } from '@/lib/monitoring';
import { recomputeVendorBillStatusesForBillIds } from '@/lib/accounts-vendor-bill-status';

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

const STATUS = new Set(['unpaid', 'partial', 'paid']);

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
    const bill = await prisma.accountsVendorBill.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, name: true, currency: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
        allocations: {
          include: {
            payment: {
              select: {
                id: true,
                paidAt: true,
                amount: true,
                reference: true,
                method: true,
              },
            },
          },
        },
      },
    });

    if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });

    const { subtotalExVat, vatAmount, totalIncVat } = computeInvoiceVatFromLines(
      bill.lines,
      bill.vatRateBps,
    );
    const allocatedTotal = bill.allocations.reduce((s, a) => s + Number(a.amount), 0);

    return NextResponse.json({
      id: bill.id,
      vendorId: bill.vendorId,
      vendorName: bill.vendor.name,
      vendorCurrency: bill.vendor.currency,
      billRef: bill.billRef,
      issueDate: bill.issueDate.toISOString().slice(0, 10),
      dueDate: bill.dueDate ? bill.dueDate.toISOString().slice(0, 10) : null,
      currency: bill.currency,
      vatRateBps: bill.vatRateBps,
      status: bill.status,
      notes: bill.notes,
      createdAt: bill.createdAt.toISOString(),
      updatedAt: bill.updatedAt.toISOString(),
      subtotalExVat,
      vatAmount,
      totalIncVat,
      allocatedTotal,
      balanceDue: Math.round((totalIncVat - allocatedTotal) * 100) / 100,
      canManageVendors: access.canManageVendors,
      lines: bill.lines.map((l, i) => ({
        id: l.id,
        item: l.item,
        description: l.description,
        amountExVat: String(l.amountExVat),
        sortOrder: l.sortOrder,
        lineNo: i + 1,
      })),
      allocations: bill.allocations.map((a) => ({
        id: a.id,
        amount: Number(a.amount),
        paymentId: a.paymentId,
        paidAt: a.payment.paidAt.toISOString().slice(0, 10),
        paymentAmount: Number(a.payment.amount),
        reference: a.payment.reference,
        method: a.payment.method,
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/vendor-bills/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load bill.' }, { status: 500 });
  }
}

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
  if (!access.canManageVendors) {
    return NextResponse.json({ error: 'You do not have permission to edit vendor bills.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const billRef =
    'billRef' in b ? (b.billRef === null ? null : str(b.billRef)) : undefined;
  const notes =
    'notes' in b ? (typeof b.notes === 'string' ? b.notes.trim() || null : null) : undefined;

  let issueDate: Date | undefined;
  if ('issueDate' in b) {
    const d = parseIsoDateOnly(b.issueDate);
    if (!d) return NextResponse.json({ error: 'issueDate must be YYYY-MM-DD.' }, { status: 400 });
    issueDate = d;
  }

  let dueDate: Date | null | undefined;
  if ('dueDate' in b) {
    if (b.dueDate === null || b.dueDate === '') dueDate = null;
    else {
      const d = parseIsoDateOnly(b.dueDate);
      if (!d) return NextResponse.json({ error: 'dueDate must be YYYY-MM-DD.' }, { status: 400 });
      dueDate = d;
    }
  }

  let vatRateBps: number | undefined;
  if ('vatRateBps' in b && b.vatRateBps !== undefined && b.vatRateBps !== null) {
    const n =
      typeof b.vatRateBps === 'number' ? b.vatRateBps : parseInt(String(b.vatRateBps), 10);
    if (!Number.isFinite(n) || n < 0 || n > 50_000) {
      return NextResponse.json({ error: 'vatRateBps invalid.' }, { status: 400 });
    }
    vatRateBps = Math.round(n);
  }

  let manualStatus: 'unpaid' | 'partial' | 'paid' | undefined;
  if ('status' in b && b.status != null) {
    if (typeof b.status !== 'string' || !STATUS.has(b.status)) {
      return NextResponse.json(
        { error: 'status must be unpaid, partial, or paid.' },
        { status: 400 },
      );
    }
    manualStatus = b.status as 'unpaid' | 'partial' | 'paid';
  }

  const linesIn = 'lines' in b ? b.lines : undefined;
  const replaceLines = Array.isArray(linesIn);

  if (
    billRef === undefined &&
    notes === undefined &&
    issueDate === undefined &&
    dueDate === undefined &&
    vatRateBps === undefined &&
    manualStatus === undefined &&
    !replaceLines
  ) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.accountsVendorBill.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw new Error('NOT_FOUND');

      if (replaceLines) {
        if (linesIn.length < 1) {
          throw Object.assign(new Error('LINES_REQUIRED'), { code: 'LINES_REQUIRED' });
        }
        const lineCreates: {
          item: string;
          description: string | null;
          amountExVat: Prisma.Decimal;
          sortOrder: number;
        }[] = [];
        for (let i = 0; i < linesIn.length; i++) {
          const row = linesIn[i];
          if (!row || typeof row !== 'object') throw new Error('BAD_LINE');
          const r = row as Record<string, unknown>;
          const item = typeof r.item === 'string' ? r.item.trim() : '';
          if (!item) throw new Error('BAD_LINE');
          const amtRaw = r.amountExVat;
          const amt =
            typeof amtRaw === 'number' && Number.isFinite(amtRaw)
              ? amtRaw
              : parseFloat(String(amtRaw ?? ''));
          if (!Number.isFinite(amt) || amt <= 0) throw new Error('BAD_LINE');
          const description =
            r.description != null && typeof r.description === 'string'
              ? r.description.trim() || null
              : null;
          lineCreates.push({
            item,
            description,
            amountExVat: new Prisma.Decimal(Math.round(amt * 100) / 100),
            sortOrder: i,
          });
        }
        await tx.accountsVendorBillLine.deleteMany({ where: { billId: id } });
        await tx.accountsVendorBillLine.createMany({
          data: lineCreates.map((lc) => ({ ...lc, billId: id })),
        });
      }

      const data: Record<string, unknown> = {};
      if (billRef !== undefined) data.billRef = billRef;
      if (notes !== undefined) data.notes = notes;
      if (issueDate !== undefined) data.issueDate = issueDate;
      if (dueDate !== undefined) data.dueDate = dueDate;
      if (vatRateBps !== undefined) data.vatRateBps = vatRateBps;

      if (Object.keys(data).length > 0) {
        await tx.accountsVendorBill.update({
          where: { id },
          data: data as Prisma.AccountsVendorBillUpdateInput,
        });
      }

      await recomputeVendorBillStatusesForBillIds(tx, [id]);

      if (manualStatus !== undefined) {
        await tx.accountsVendorBill.update({
          where: { id },
          data: { status: manualStatus },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Bill not found.' }, { status: 404 });
    }
    const err = error as { code?: string };
    if (err.code === 'LINES_REQUIRED') {
      return NextResponse.json({ error: 'At least one line is required.' }, { status: 400 });
    }
    if (msg === 'BAD_LINE') {
      return NextResponse.json({ error: 'Invalid line items.' }, { status: 400 });
    }
    await reportApiError({
      route: 'PATCH /api/accounts/vendor-bills/[id]',
      message: msg,
    });
    return NextResponse.json({ error: 'Failed to update bill.' }, { status: 500 });
  }
}
