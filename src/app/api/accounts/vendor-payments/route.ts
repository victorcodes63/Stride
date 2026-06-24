import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
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

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }

  const vendorId = request.nextUrl.searchParams.get('vendorId')?.trim();
  if (!vendorId) {
    return NextResponse.json({ error: 'vendorId query is required.' }, { status: 400 });
  }

  try {
    const payments = await prisma.accountsVendorPayment.findMany({
      where: { vendorId },
      orderBy: { paidAt: 'desc' },
      take: 100,
      include: {
        allocations: {
          select: { id: true, billId: true, amount: true },
        },
      },
    });

    return NextResponse.json({
      payments: payments.map((p) => ({
        id: p.id,
        vendorId: p.vendorId,
        paidAt: p.paidAt.toISOString().slice(0, 10),
        amount: Number(p.amount),
        reference: p.reference,
        method: p.method,
        notes: p.notes,
        allocations: p.allocations.map((a) => ({
          id: a.id,
          billId: a.billId,
          amount: Number(a.amount),
        })),
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/vendor-payments',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load payments.' }, { status: 500 });
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
      { error: 'You do not have permission to record vendor payments.' },
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
  const vendorId = str(b.vendorId);
  if (!vendorId) {
    return NextResponse.json({ error: 'vendorId is required.' }, { status: 400 });
  }

  const paidAt = parseIsoDateOnly(b.paidAt);
  if (!paidAt) {
    return NextResponse.json({ error: 'paidAt is required (YYYY-MM-DD).' }, { status: 400 });
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
      { error: 'allocations is required: [{ billId, amount }, ...]' },
      { status: 400 },
    );
  }

  const allocationRows: { billId: string; amt: number }[] = [];
  for (const row of allocationsIn) {
    if (!row || typeof row !== 'object') {
      return NextResponse.json({ error: 'Invalid allocation.' }, { status: 400 });
    }
    const r = row as Record<string, unknown>;
    const billId = str(r.billId);
    if (!billId) return NextResponse.json({ error: 'Each allocation needs billId.' }, { status: 400 });
    const aRaw = r.amount;
    const a =
      typeof aRaw === 'number' && Number.isFinite(aRaw) ? aRaw : parseFloat(String(aRaw ?? ''));
    if (!Number.isFinite(a) || a <= 0) {
      return NextResponse.json({ error: 'Each allocation amount must be positive.' }, { status: 400 });
    }
    allocationRows.push({ billId, amt: Math.round(a * 100) / 100 });
  }

  const allocSum = allocationRows.reduce((s, x) => s + x.amt, 0);
  if (Math.abs(allocSum - amount) > 0.02) {
    return NextResponse.json(
      { error: `Allocation total (${allocSum}) must equal payment amount (${amount}).` },
      { status: 400 },
    );
  }

  try {
    const paymentId = await prisma.$transaction(async (tx) => {
      const vendor = await tx.accountsVendor.findUnique({
        where: { id: vendorId },
        select: { id: true },
      });
      if (!vendor) {
        throw Object.assign(new Error('VENDOR_NOT_FOUND'), { code: 'VENDOR_NOT_FOUND' });
      }

      const billIds = [...new Set(allocationRows.map((x) => x.billId))];
      const bills = await tx.accountsVendorBill.findMany({
        where: { id: { in: billIds }, vendorId },
        select: { id: true },
      });
      if (bills.length !== billIds.length) {
        throw Object.assign(new Error('BILL_MISMATCH'), { code: 'BILL_MISMATCH' });
      }

      const payment = await tx.accountsVendorPayment.create({
        data: {
          vendorId,
          paidAt,
          amount: new Prisma.Decimal(amount),
          reference,
          method,
          notes,
          allocations: {
            create: allocationRows.map((x) => ({
              billId: x.billId,
              amount: new Prisma.Decimal(x.amt),
            })),
          },
        },
        select: { id: true },
      });

      await recomputeVendorBillStatusesForBillIds(tx, billIds);
      return payment.id;
    });

    return NextResponse.json({ id: paymentId }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'VENDOR_NOT_FOUND') {
      return NextResponse.json({ error: 'Vendor not found.' }, { status: 404 });
    }
    if (err.code === 'BILL_MISMATCH') {
      return NextResponse.json(
        { error: 'One or more bills were not found or do not belong to this vendor.' },
        { status: 400 },
      );
    }
    await reportApiError({
      route: 'POST /api/accounts/vendor-payments',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to record payment.' }, { status: 500 });
  }
}
