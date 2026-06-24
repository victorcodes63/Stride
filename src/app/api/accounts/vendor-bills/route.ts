import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { computeInvoiceVatFromSubtotal } from '@/lib/accounts-invoice-totals';
import { reportApiError } from '@/lib/monitoring';
import { requireRecentSensitiveAuth } from '@/lib/admin-security';
import { logAuditEvent } from '@/lib/audit-events';

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

  const vendorId = request.nextUrl.searchParams.get('vendorId')?.trim() || undefined;

  try {
    const bills = await prisma.accountsVendorBill.findMany({
      where: vendorId ? { vendorId } : {},
      select: {
        id: true,
        vendorId: true,
        billRef: true,
        issueDate: true,
        dueDate: true,
        currency: true,
        vatRateBps: true,
        status: true,
        notes: true,
        vendor: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    const ids = bills.map((b) => b.id);
    const aggregates =
      ids.length === 0
        ? []
        : await prisma.accountsVendorBillLine.groupBy({
            by: ['billId'],
            where: { billId: { in: ids } },
            _sum: { amountExVat: true },
          });

    const subtotalByBill = new Map<string, number>();
    for (const row of aggregates) {
      subtotalByBill.set(row.billId, Number(row._sum.amountExVat ?? 0));
    }

    const list = bills.map((bill) => {
      const subtotalExVat = subtotalByBill.get(bill.id) ?? 0;
      const { vatAmount, totalIncVat } = computeInvoiceVatFromSubtotal(subtotalExVat, bill.vatRateBps);
      return {
        id: bill.id,
        vendorId: bill.vendorId,
        vendorName: bill.vendor.name,
        billRef: bill.billRef,
        issueDate: bill.issueDate.toISOString().slice(0, 10),
        dueDate: bill.dueDate ? bill.dueDate.toISOString().slice(0, 10) : null,
        currency: bill.currency,
        vatRateBps: bill.vatRateBps,
        status: bill.status,
        notes: bill.notes,
        subtotalExVat,
        vatAmount,
        totalIncVat,
        lineCount: bill._count.lines,
      };
    });

    return NextResponse.json({ bills: list });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/vendor-bills',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load bills.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }
  if (!access.canManageVendors) {
    return NextResponse.json(
      { error: 'You do not have permission to create vendor bills.' },
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
  const vendorId = str(b.vendorId);
  if (!vendorId) {
    return NextResponse.json({ error: 'vendorId is required.' }, { status: 400 });
  }

  const issueDate = parseIsoDateOnly(b.issueDate);
  if (!issueDate) {
    return NextResponse.json({ error: 'issueDate is required (YYYY-MM-DD).' }, { status: 400 });
  }

  const dueDateRaw = b.dueDate;
  const dueDate =
    dueDateRaw === null || dueDateRaw === undefined || dueDateRaw === ''
      ? null
      : parseIsoDateOnly(dueDateRaw);
  if (dueDateRaw !== null && dueDateRaw !== undefined && dueDateRaw !== '' && !dueDate) {
    return NextResponse.json({ error: 'dueDate must be YYYY-MM-DD or empty.' }, { status: 400 });
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

  const billRef = str(b.billRef);
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
    const bill = await prisma.$transaction(async (tx) => {
      const vendor = await tx.accountsVendor.findUnique({
        where: { id: vendorId },
        select: { id: true, currency: true },
      });
      if (!vendor) {
        throw Object.assign(new Error('VENDOR_NOT_FOUND'), { code: 'VENDOR_NOT_FOUND' });
      }

      const currency = (currencyOverride ?? vendor.currency ?? 'KES').trim() || 'KES';

      return tx.accountsVendorBill.create({
        data: {
          vendorId,
          billRef,
          issueDate,
          dueDate,
          currency,
          vatRateBps,
          status: 'unpaid',
          notes,
          lines: { create: lineCreates },
        },
        select: { id: true },
      });
    });

    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'accounts.vendor_bill.created',
      entityType: 'AccountsVendorBill',
      entityId: bill.id,
      route: 'POST /api/accounts/vendor-bills',
      metadata: { vendorId },
    });
    return NextResponse.json({ id: bill.id }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'VENDOR_NOT_FOUND') {
      return NextResponse.json({ error: 'Vendor not found.' }, { status: 404 });
    }
    await reportApiError({
      route: 'POST /api/accounts/vendor-bills',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create bill.' }, { status: 500 });
  }
}
