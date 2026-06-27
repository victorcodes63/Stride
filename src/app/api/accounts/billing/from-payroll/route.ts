import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
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
  return withAccountsTenant(request, async (ctx) => {
    const access = await getAccountsAccess(ctx.staff.id, ctx.staff.role);
    if (!access.canManageInvoices) {
      return NextResponse.json({ error: 'No permission to create invoices.' }, { status: 403 });
    }

    try {
      const body = (await request.json()) as Record<string, unknown>;
      const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
      if (!clientId) return NextResponse.json({ error: 'clientId is required.' }, { status: 400 });

      const period = parseMonthYear(body);
      if (!period) return NextResponse.json({ error: 'Valid month (1–12) and year are required.' }, { status: 400 });

      const result = await ctx.run(async (tx) => {
        const client = await tx.accountsClient.findFirst({
          where: ctx.where({ id: clientId }),
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
        if (!client) throw Object.assign(new Error('CLIENT_NOT_FOUND'), { code: 'CLIENT_NOT_FOUND' });
        if (!client.outsourcingClient) {
          throw Object.assign(new Error('OUTSOURCING_REQUIRED'), { code: 'OUTSOURCING_REQUIRED' });
        }

        const payrollRows = await tx.payroll.findMany({
          where: {
            organizationId: ctx.organizationId,
            month: period.month,
            year: period.year,
            status: { in: ['approved', 'paid'] },
            employee: { outsourcingClientId: client.outsourcingClient.id },
          },
          select: { grossPay: true, netPay: true, nita: true },
        });
        if (payrollRows.length === 0) {
          throw Object.assign(new Error('NO_PAYROLL'), { code: 'NO_PAYROLL' });
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

        const invoice = await createDraftAccountsInvoice(tx, {
          clientId,
          issueDate,
          dueDate,
          currency: profile.currency ?? 'KES',
          notes: `Auto-generated from approved payroll ${period.month}/${period.year} (${payrollRows.length} employees).`,
          lines,
        });

        return { invoice, employeeCount: payrollRows.length, lines };
      });

      return NextResponse.json(
        {
          invoiceId: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber,
          employeeCount: result.employeeCount,
          lines: result.lines,
        },
        { status: 201 },
      );
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'CLIENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
      }
      if (err.code === 'OUTSOURCING_REQUIRED') {
        return NextResponse.json({ error: 'Payroll billing requires an outsourcing client link.' }, { status: 400 });
      }
      if (err.code === 'NO_PAYROLL') {
        return NextResponse.json(
          { error: 'No approved payroll rows found for this period and client.' },
          { status: 400 },
        );
      }
      await reportApiError({
        route: 'POST /api/accounts/billing/from-payroll',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to generate payroll invoice.' }, { status: 500 });
    }
  });
}
