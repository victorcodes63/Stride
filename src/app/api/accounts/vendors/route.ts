import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

export async function GET(_request: NextRequest) {
  const user = await requireStaffUser(_request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }

  try {
    const rows = await prisma.accountsVendor.findMany({
      select: {
        id: true,
        name: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        currency: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { bills: true, payments: true } },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });

    const vendors = rows.map((v) => ({
      id: v.id,
      name: v.name,
      contactName: v.contactName,
      contactEmail: v.contactEmail,
      contactPhone: v.contactPhone,
      currency: v.currency,
      notes: v.notes,
      counts: { bills: v._count.bills, payments: v._count.payments },
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    }));

    return NextResponse.json({ vendors });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/vendors',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load vendors.' }, { status: 500 });
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
    return NextResponse.json({ error: 'You do not have permission to manage vendors.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = str(b.name);
  if (!name) {
    return NextResponse.json({ error: 'name is required.' }, { status: 400 });
  }

  const currency = (str(b.currency) ?? 'KES').trim() || 'KES';
  const contactName = str(b.contactName);
  const contactEmail = str(b.contactEmail);
  const contactPhone = str(b.contactPhone);
  const notes = b.notes != null && typeof b.notes === 'string' ? b.notes.trim() || null : null;

  try {
    const v = await prisma.accountsVendor.create({
      data: {
        name,
        currency,
        contactName,
        contactEmail,
        contactPhone,
        notes,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: v.id }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/accounts/vendors',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create vendor.' }, { status: 500 });
  }
}
