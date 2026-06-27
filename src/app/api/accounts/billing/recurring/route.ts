import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
import { getAccountsAccess } from '@/lib/accounts-access';
import { reportApiError } from '@/lib/monitoring';
import {
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

        const profile = {
          serviceFeeType: client.outsourcingClient?.serviceFeeType ?? null,
          serviceFeeAmount: client.outsourcingClient?.serviceFeeAmount
            ? Number(client.outsourcingClient.serviceFeeAmount)
            : null,
          paymentTerms: client.outsourcingClient?.paymentTerms ?? null,
          currency: client.outsourcingClient?.currency ?? client.currency,
        };

        const headcount = client.outsourcingClient
          ? await tx.employee.count({
              where: {
                organizationId: ctx.organizationId,
                outsourcingClientId: client.outsourcingClient.id,
                employmentStatus: 'active',
              },
            })
          : 0;

        const lines = buildRecurringBillLines({
          month: period.month,
          year: period.year,
          headcount,
          profile,
        });
        if (lines.length === 0) {
          throw Object.assign(new Error('NO_BILLABLE'), { code: 'NO_BILLABLE' });
        }

        const issueDate = new Date(Date.UTC(period.year, period.month - 1, 1, 12, 0, 0));
        const dueDate = dueDateFromIssue(issueDate, profile.paymentTerms);

        const invoice = await createDraftAccountsInvoice(tx, {
          clientId,
          issueDate,
          dueDate,
          currency: profile.currency ?? 'KES',
          notes: `Auto-generated recurring bill for ${period.month}/${period.year} (${headcount} employees).`,
          lines,
        });

        return { invoice, headcount, lines };
      });

      return NextResponse.json(
        {
          invoiceId: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber,
          headcount: result.headcount,
          lines: result.lines,
        },
        { status: 201 },
      );
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'CLIENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
      }
      if (err.code === 'NO_BILLABLE') {
        return NextResponse.json(
          { error: 'No billable amount for this client (check service fee settings).' },
          { status: 400 },
        );
      }
      await reportApiError({
        route: 'POST /api/accounts/billing/recurring',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to generate recurring invoice.' }, { status: 500 });
    }
  });
}
