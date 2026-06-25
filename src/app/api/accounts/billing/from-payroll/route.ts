import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { reportApiError } from '@/lib/monitoring';
import {
  buildPayrollInvoiceLines,
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
    if (!client) return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    if (!client.outsourcingClient) {
      return NextResponse.json({ error: 'Payroll billing requires an outsourcing client link.' }, { status: 400 });
    }

    const payrollRows = await prisma.payroll.findMany({
      where: {
        month: period.month,
        year: period.year,
        status: { in: ['approved', 'paid'] },
        employee: { outsourcingClientId: client.outsourcingClient.id },
      },
      select: { grossPay: true, netPay: true, nita: true },
    });
    if (payrollRows.length === 0) {
      return NextResponse.json(
        { error: 'No approved payroll rows found for this period and client.' },
        { status: 400 },
      );
    }

    const profile = {
      serviceFeeType: client.outsourcingClient.serviceFeeType,
      serviceFeeAmount: client.outsourcingClient.serviceFeeAmount
        ? Number(client.outsourcingClient.serviceFeeAmount)
        : null,
      paymentTerms: client.outsourcingClient.paymentTerms,
      currency: client.outsourcingClient.currency ?? client.currency,
    };

    const lines = buildPayrollInvoiceLines({
      month: period.month,
      year: period.year,
      headcount: payrollRows.length,
      profile,
      payrollRows: payrollRows.map((r) => ({
        grossPay: Number(r.grossPay),
        netPay: Number(r.netPay),
        nita: Number(r.nita),
      })),
    });

    const issueDate = new Date();
    issueDate.setUTCHours(12, 0, 0, 0);
    const dueDate = dueDateFromIssue(issueDate, profile.paymentTerms);

    const invoice = await prisma.$transaction((tx) =>
      createDraftAccountsInvoice(tx, {
        clientId,
        issueDate,
        dueDate,
        currency: profile.currency ?? 'KES',
        notes: `Auto-generated from approved payroll ${period.month}/${period.year} (${payrollRows.length} employees).`,
        lines,
      }),
    );

    return NextResponse.json(
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        employeeCount: payrollRows.length,
        lines,
      },
      { status: 201 },
    );
  } catch (error) {
    await reportApiError({
      route: 'POST /api/accounts/billing/from-payroll',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate payroll invoice.' }, { status: 500 });
  }
}
