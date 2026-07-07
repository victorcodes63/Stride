import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import { generateOutsourcingClientInvoice, type OutsourcingBillMode } from '@/lib/outsourcing-billing';

export const dynamic = 'force-dynamic';

function parsePeriod(body: Record<string, unknown>) {
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
  return withTenant(request, async (ctx) => {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const outsourcingClientId =
        typeof body.outsourcingClientId === 'string' ? body.outsourcingClientId.trim() : '';
      if (!outsourcingClientId) {
        return NextResponse.json({ error: 'outsourcingClientId is required.' }, { status: 400 });
      }

      const period = parsePeriod(body);
      if (!period) {
        return NextResponse.json({ error: 'Valid month (1–12) and year are required.' }, { status: 400 });
      }

      const modeRaw = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : 'monthly';
      const mode: OutsourcingBillMode = modeRaw === 'payroll' ? 'payroll' : 'monthly';

      const result = await ctx.run((tx) =>
        generateOutsourcingClientInvoice(tx, {
          organizationId: ctx.organizationId,
          outsourcingClientId,
          month: period.month,
          year: period.year,
          mode,
        }),
      );

      return NextResponse.json(
        {
          invoiceId: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber,
          accountsClientId: result.accountsClientId,
          headcount: result.headcount,
          lines: result.lines,
          mode,
        },
        { status: 201 },
      );
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'OUTSOURCING_CLIENT_NOT_FOUND') {
        return NextResponse.json({ error: 'End-client not found.' }, { status: 404 });
      }
      if (err.code === 'PAYROLL_NOT_APPROVED') {
        return NextResponse.json(
          { error: 'No approved payroll run for this period. Approve payroll before billing pass-through.' },
          { status: 400 },
        );
      }
      if (err.code === 'NO_BILLABLE_LINES') {
        return NextResponse.json(
          { error: 'No billable lines — configure a rate card or service fee on the end-client.' },
          { status: 400 },
        );
      }
      await reportApiError({
        route: 'POST /api/outsourcing/billing/generate',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to generate invoice.' }, { status: 500 });
    }
  });
}
