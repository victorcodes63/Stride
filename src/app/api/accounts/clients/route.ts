import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { reportApiError } from '@/lib/monitoring';
import { syncLinkedBillingClients } from '@/lib/sync-accounts-clients';
import type { AccountsClientType } from '@prisma/client';
import { resolveEntityIdOrDefault } from '@/lib/entity-request';

export const dynamic = 'force-dynamic';

const VALID_TYPES: AccountsClientType[] = ['custom', 'recruitment', 'outsourcing'];

function optId(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

/** Optional long text: empty string → null. */
function billingNotesFromBody(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
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
    const activeEntity = await resolveEntityIdOrDefault(request);
    const syncParam = request.nextUrl.searchParams.get('sync')?.toLowerCase() ?? '';
    const runSync = syncParam === '1' || syncParam === 'true' || syncParam === 'yes';

    let syncResult: {
      deletedDemoCount: number;
      recruitmentSynced: number;
      outsourcingSynced: number;
    } | null = null;
    if (runSync) {
      syncResult = await syncLinkedBillingClients(prisma);
    }

    // No joins to Client / OutsourcingClient: list uses denormalised `name` from billing row (sync updates it).
    const rows = await prisma.accountsClient.findMany({
      where: activeEntity
        ? {
            OR: [
              { type: 'custom' },
              { type: 'recruitment' },
              {
                type: 'outsourcing',
                outsourcingClient: { entityCode: activeEntity },
              },
            ],
          }
        : undefined,
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
      orderBy: { name: 'asc' },
      take: 500,
    });

    const clients = rows.map((c) => ({
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
    }));

    return NextResponse.json(
      syncResult ? { clients, sync: syncResult } : { clients },
    );
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/clients',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load clients.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const type = b.type as AccountsClientType;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: 'Invalid type. Use custom, recruitment, or outsourcing.' },
      { status: 400 },
    );
  }

  const recruitmentClientId = optId(b.recruitmentClientId);
  const outsourcingClientId = optId(b.outsourcingClientId);
  let name = str(b.name) ?? '';
  const currency = str(b.currency) ?? 'KES';
  let contactName = str(b.contactName);
  let contactEmail = str(b.contactEmail);
  let contactPhone = str(b.contactPhone);
  const billingNotesOpt = billingNotesFromBody(b.billingNotes);
  const activeEntity = await resolveEntityIdOrDefault(request);

  if (type === 'custom') {
    if (recruitmentClientId || outsourcingClientId) {
      return NextResponse.json(
        { error: 'Custom clients cannot be linked to recruitment or outsourcing records.' },
        { status: 400 },
      );
    }
    if (!name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }
  } else if (type === 'recruitment') {
    if (!recruitmentClientId || outsourcingClientId) {
      return NextResponse.json(
        { error: 'Recruitment billing clients require recruitmentClientId only.' },
        { status: 400 },
      );
    }
    const rc = await prisma.client.findUnique({ where: { id: recruitmentClientId } });
    if (!rc) {
      return NextResponse.json({ error: 'Recruitment client not found.' }, { status: 404 });
    }
    const taken = await prisma.accountsClient.findUnique({
      where: { recruitmentClientId },
    });
    if (taken) {
      return NextResponse.json(
        { error: 'This recruitment client already has a billing profile.' },
        { status: 409 },
      );
    }
    if (!name) name = rc.name;
    contactName ??= rc.contactName ?? null;
    contactEmail ??= rc.contactEmail ?? null;
    contactPhone ??= rc.contactPhone ?? null;
  } else {
    // outsourcing
    if (!outsourcingClientId || recruitmentClientId) {
      return NextResponse.json(
        { error: 'Outsourcing billing clients require outsourcingClientId only.' },
        { status: 400 },
      );
    }
    const oc = await prisma.outsourcingClient.findUnique({ where: { id: outsourcingClientId } });
    if (!oc) {
      return NextResponse.json({ error: 'Outsourcing client not found.' }, { status: 404 });
    }
    if (activeEntity && oc.entityCode !== activeEntity) {
      return NextResponse.json(
        { error: `Cannot create billing profile for client outside active entity (${activeEntity}).` },
        { status: 403 },
      );
    }
    const taken = await prisma.accountsClient.findUnique({
      where: { outsourcingClientId },
    });
    if (taken) {
      return NextResponse.json(
        { error: 'This outsourcing client already has a billing profile.' },
        { status: 409 },
      );
    }
    if (!name) name = oc.name;
    contactName ??= oc.contactName ?? null;
    contactEmail ??= oc.contactEmail ?? null;
    contactPhone ??= oc.contactPhone ?? null;
  }

  try {
    const created = await prisma.accountsClient.create({
      data: {
        type,
        name,
        currency,
        contactName,
        contactEmail,
        contactPhone,
        ...(billingNotesOpt !== undefined ? { billingNotes: billingNotesOpt } : {}),
        recruitmentClientId,
        outsourcingClientId,
      },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/accounts/clients',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create client.' }, { status: 500 });
  }
}
