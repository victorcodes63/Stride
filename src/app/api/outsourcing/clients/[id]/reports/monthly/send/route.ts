import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import { sendEmail } from '@/lib/email';
import {
  buildOutsourcingMonthlyReport,
  renderOutsourcingReportHtml,
} from '@/lib/outsourcing-client-reports';
import { generateOutsourcingReportPdf } from '@/lib/outsourcing-report-pdf';

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

/** POST /api/outsourcing/clients/[id]/reports/monthly/send — email white-label PDF pack (OUT-08). */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    try {
      const { id } = await context.params;
      const body = (await request.json()) as Record<string, unknown>;
      const period = parsePeriod(body);
      if (!period) {
        return NextResponse.json({ error: 'Valid month and year are required.' }, { status: 400 });
      }

      const report = await ctx.run((tx) =>
        buildOutsourcingMonthlyReport(tx, {
          organizationId: ctx.organizationId,
          outsourcingClientId: id,
          month: period.month,
          year: period.year,
        }),
      );

      const recipients = report.client.reportRecipientEmails;
      if (recipients.length === 0) {
        return NextResponse.json(
          { error: 'No report recipient emails configured on this end-client.' },
          { status: 400 },
        );
      }

      const pdfBytes = await generateOutsourcingReportPdf(report);
      const html = renderOutsourcingReportHtml(report);
      const brandName = report.client.whiteLabelReports ? report.client.name : 'Stride HR Outsourcing';

      const result = await sendEmail({
        to: recipients[0]!,
        cc: recipients.slice(1),
        subject: `${brandName} — Workforce report ${report.period.label}`,
        html,
        attachments: [
          {
            filename: `workforce-report-${period.year}-${String(period.month).padStart(2, '0')}.pdf`,
            content: Buffer.from(pdfBytes),
          },
        ],
      });

      if (!result.sent) {
        return NextResponse.json(
          { error: result.reason === 'resend_not_configured' ? 'Email is not configured.' : 'Failed to send report.' },
          { status: 503 },
        );
      }

      await ctx.audit({
        action: 'outsourcing.report_emailed',
        entityType: 'OutsourcingClient',
        entityId: id,
        route: 'POST /api/outsourcing/clients/[id]/reports/monthly/send',
        metadata: { month: period.month, year: period.year, recipients },
      });

      return NextResponse.json({ ok: true, recipients, messageId: result.messageId ?? null });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === 'OUTSOURCING_CLIENT_NOT_FOUND') {
        return NextResponse.json({ error: 'End-client not found.' }, { status: 404 });
      }
      await reportApiError({
        route: 'POST /api/outsourcing/clients/[id]/reports/monthly/send',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to send report.' }, { status: 500 });
    }
  });
}
