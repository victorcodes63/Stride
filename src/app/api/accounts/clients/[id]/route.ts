import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { reportApiError } from '@/lib/monitoring';
import { syncLinkedBillingClients } from '@/lib/sync-accounts-clients';

export const dynamic = 'force-dynamic';

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

function billingNotesFromBody(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
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
    const syncParam = request.nextUrl.searchParams.get('sync')?.toLowerCase() ?? '';
    const runSync = syncParam === '1' || syncParam === 'true' || syncParam === 'yes';
    if (runSync) {
      await syncLinkedBillingClients(prisma);
    }

    const c = await prisma.accountsClient.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        name: true,
        currency: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        billingNotes: true,
        nextInvoiceNumber: true,
        recruitmentClientId: true,
        outsourcingClientId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            invoices: true,
            contracts: true,
            clientPayments: true,
            payrolls: true,
          },
        },
      },
    });

    if (!c) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    return NextResponse.json({
      id: c.id,
      type: c.type,
      name: c.name,
      currency: c.currency,
      contactName: c.contactName,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      billingNotes: c.billingNotes,
      nextInvoiceNumber: c.nextInvoiceNumber,
      recruitmentClientId: c.recruitmentClientId,
      outsourcingClientId: c.outsourcingClientId,
      recruitmentClientName: c.recruitmentClientId ? c.name : null,
      outsourcingClientName: c.outsourcingClientId ? c.name : null,
      counts: {
        invoices: c._count.invoices,
        contracts: c._count.contracts,
        payments: c._count.clientPayments,
        payrolls: c._count.payrolls,
      },
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/clients/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load client.' }, { status: 500 });
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

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = b.name !== undefined ? str(b.name) : undefined;
  if (name !== undefined && !name) {
    return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 });
  }

  const currency = b.currency !== undefined ? str(b.currency) : undefined;
  if (currency !== undefined && !currency) {
    return NextResponse.json({ error: 'Currency cannot be empty.' }, { status: 400 });
  }

  const contactName = b.contactName !== undefined ? (str(b.contactName) ?? null) : undefined;
  const contactEmail = b.contactEmail !== undefined ? (str(b.contactEmail) ?? null) : undefined;
  const contactPhone = b.contactPhone !== undefined ? (str(b.contactPhone) ?? null) : undefined;
  const billingNotes = billingNotesFromBody(b.billingNotes);

  let nextInvoiceNumber: number | undefined;
  if (b.nextInvoiceNumber !== undefined) {
    const n =
      typeof b.nextInvoiceNumber === 'number'
        ? b.nextInvoiceNumber
        : parseInt(String(b.nextInvoiceNumber), 10);
    if (!Number.isFinite(n) || n < 1) {
      return NextResponse.json(
        { error: 'nextInvoiceNumber must be an integer ≥ 1.' },
        { status: 400 },
      );
    }
    nextInvoiceNumber = Math.floor(n);
  }

  const data: {
    name?: string;
    currency?: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    billingNotes?: string | null;
    nextInvoiceNumber?: number;
  } = {};
  if (name !== undefined) data.name = name;
  if (currency !== undefined) data.currency = currency;
  if (contactName !== undefined) data.contactName = contactName;
  if (contactEmail !== undefined) data.contactEmail = contactEmail;
  if (contactPhone !== undefined) data.contactPhone = contactPhone;
  if (billingNotes !== undefined) data.billingNotes = billingNotes;
  if (nextInvoiceNumber !== undefined) data.nextInvoiceNumber = nextInvoiceNumber;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  try {
    await prisma.accountsClient.update({
      where: { id },
      data,
    });
  } catch {
    return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
