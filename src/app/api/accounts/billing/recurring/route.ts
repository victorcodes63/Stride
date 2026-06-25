import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { reportApiError } from '@/lib/monitoring';
import {
  buildPayrollInvoiceLines,
  buildRecurringBillLines,
  createDraftAccountsInvoice,
  dueDateFromIssue,
} from '@/lib/accounts/billing-automation';

export const dynamic = 'force-dynamic';

function parseMonthYear(body: Record<string, unknown>) {
  const now = new Date();
  const month =
    typeof body.month === 'number'
      ? body.month
      : parseInt(String(body.month ?? now.getUTCMonth() + 1), 10);
  const year =
    typeof body.year === 'number' ? body.year : parseInt(String(body.year ?? now.getUTCFullYear()), 10);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return null;
  return { month, year };
}

async function loadBillingContext(clientId: string) {
  const client = await prisma.accountsClient.findUnique({
    where: { id: clientId },
    include: {
      outsourcingClient: {
        select: {
          id: true,
          serviceFeeType: true,
          serviceFeeAmount: true,
          paymentTerms: true,
          currency: true,
        },
      },
    },
  });
  if (!client) return null;
  return client;
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess || !access.canManageInvoices) {
    return NextResponse.json({ error: 'No permission to create invoices.' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
    if (!clientId) return NextResponse.json({ error: 'clientId is required.' }, { status: 400 });

    const period = parseMonthYear(body);
    if (!period) return NextResponse.json({ error: 'Valid month (1–12) and year are required.' }, { status: 400 });

    const client = await loadBillingContext(clientId);
    if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });

    const profile = {
      serviceFeeType: client.outsourcingClient?.serviceFeeType ?? null,
      serviceFeeAmount: client.outsourcingClient?.serviceFeeAmount
        ? Number(client.outsourcingClient.serviceFeeAmount)
        : null,
      paymentTerms: client.outsourcingClient?.paymentTerms ?? null,
      currency: client.outsourcingClient?.currency ?? client.currency,
    };

    const headcount = client.outsourcingClient
      ? await prisma.employee.count({
          where: { outsourcingClientId: client.outsourcingClient.id, employmentStatus: 'active' },
        })
      : 0;

    const lines = buildRecurringBillLines({
      month: period.month,
      year: period.year,
      headcount,
      profile,
    });
    if (lines.length === 0) {
      return NextResponse.json({ error: 'No billable amount for this client (check service fee settings).' }, { status: 400 });
    }

    const issueDate = new Date(Date.UTC(period.year, period.month - 1, 1, 12, 0, 0));
    const dueDate = dueDateFromIssue(issueDate, profile.paymentTerms);

    const invoice = await prisma.$transaction((tx) =>
      createDraftAccountsInvoice(tx, {
        clientId,
        issueDate,
        dueDate,
        currency: profile.currency ?? 'KES',
        notes: `Auto-generated recurring bill for ${period.month}/${period.year} (${headcount} employees).`,
        lines,
      }),
    );

    return NextResponse.json({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, headcount, lines }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/accounts/billing/recurring',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate recurring invoice.' }, { status: 500 });
  }
}
