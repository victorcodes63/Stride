import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { computeInvoiceVatFromSubtotal } from '@/lib/accounts-invoice-totals';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
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
    const v = await prisma.accountsVendor.findUnique({
      where: { id },
      include: {
        bills: {
          orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
          take: 100,
          select: {
            id: true,
            billRef: true,
            issueDate: true,
            dueDate: true,
            currency: true,
            vatRateBps: true,
            status: true,
            notes: true,
            lines: true,
          },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 50,
          select: {
            id: true,
            paidAt: true,
            amount: true,
            reference: true,
            method: true,
            notes: true,
          },
        },
      },
    });

    if (!v) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    const bills = v.bills.map((bill) => {
      const subtotal = bill.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
      const { vatAmount, totalIncVat } = computeInvoiceVatFromSubtotal(subtotal, bill.vatRateBps);
      return {
        id: bill.id,
        billRef: bill.billRef,
        issueDate: bill.issueDate.toISOString().slice(0, 10),
        dueDate: bill.dueDate ? bill.dueDate.toISOString().slice(0, 10) : null,
        currency: bill.currency,
        vatRateBps: bill.vatRateBps,
        status: bill.status,
        notes: bill.notes,
        subtotalExVat: subtotal,
        vatAmount,
        totalIncVat,
        lineCount: bill.lines.length,
      };
    });

    return NextResponse.json({
      id: v.id,
      name: v.name,
      contactName: v.contactName,
      contactEmail: v.contactEmail,
      contactPhone: v.contactPhone,
      currency: v.currency,
      notes: v.notes,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      canManageVendors: access.canManageVendors,
      bills,
      payments: v.payments.map((p) => ({
        id: p.id,
        paidAt: p.paidAt.toISOString().slice(0, 10),
        amount: Number(p.amount),
        reference: p.reference,
        method: p.method,
        notes: p.notes,
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/vendors/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load vendor.' }, { status: 500 });
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
    return NextResponse.json({ error: 'You do not have permission to manage vendors.' }, { status: 403 });
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
  const data: {
    name?: string;
    currency?: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    notes?: string | null;
  } = {};

  if ('name' in b) {
    const name = str(b.name);
    if (!name) return NextResponse.json({ error: 'name cannot be empty.' }, { status: 400 });
    data.name = name;
  }
  if ('currency' in b && b.currency != null) {
    const c = str(b.currency);
    data.currency = (c ?? 'KES').trim() || 'KES';
  }
  if ('contactName' in b) data.contactName = b.contactName === null ? null : str(b.contactName);
  if ('contactEmail' in b) data.contactEmail = b.contactEmail === null ? null : str(b.contactEmail);
  if ('contactPhone' in b) data.contactPhone = b.contactPhone === null ? null : str(b.contactPhone);
  if ('notes' in b) {
    data.notes = typeof b.notes === 'string' ? b.notes.trim() || null : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  try {
    await prisma.accountsVendor.update({
      where: { id },
      data,
    });
  } catch {
    return NextResponse.json({ error: 'Vendor not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
