import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import { generateAccountsInvoicePdf } from '@/lib/accounts-invoice-pdf';
import { reportApiError } from '@/lib/monitoring';
import { resolvePaymentDetails } from '@/lib/payment-accounts';
import { resolveInvoicePdfBranding } from '@/lib/invoice-setup';

export const dynamic = 'force-dynamic';

type PreviewLine = {
  item?: string;
  description?: string | null;
  amountExVat?: number | string;
};

export async function POST(request: NextRequest) {
  return withAccountsTenant(request, async (ctx) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
    if (!clientName) {
      return NextResponse.json({ error: 'Client name is required for preview.' }, { status: 400 });
    }

    const issueDate =
      typeof body.issueDate === 'string' && body.issueDate.trim()
        ? body.issueDate.trim()
        : new Date().toISOString().slice(0, 10);
    const dueDate =
      typeof body.dueDate === 'string' && body.dueDate.trim() ? body.dueDate.trim() : null;
    const currency =
      typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'KES';
    const vatRateBps =
      typeof body.vatRateBps === 'number' && Number.isFinite(body.vatRateBps)
        ? Math.round(body.vatRateBps)
        : 1600;
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    const paymentAccountId =
      typeof body.paymentAccountId === 'string' ? body.paymentAccountId.trim() : '';
    const previewNumber =
      typeof body.previewInvoiceNumber === 'number' && body.previewInvoiceNumber > 0
        ? Math.round(body.previewInvoiceNumber)
        : 1;

    const rawLines = Array.isArray(body.lines) ? (body.lines as PreviewLine[]) : [];
    const amountLines = rawLines
      .map((line, index) => {
        const item = typeof line.item === 'string' ? line.item.trim() : '';
        const amount = Number(line.amountExVat);
        if (!item || !Number.isFinite(amount) || amount <= 0) return null;
        return {
          lineNo: index + 1,
          item,
          description: typeof line.description === 'string' ? line.description.trim() || null : null,
          amountExVat: String(amount),
        };
      })
      .filter((line): line is NonNullable<typeof line> => line != null);

    if (amountLines.length < 1) {
      return NextResponse.json(
        { error: 'Add at least one line with a description and positive amount.' },
        { status: 400 },
      );
    }

    try {
      const { subtotalExVat, vatAmount, totalIncVat } = computeInvoiceVatFromLines(
        amountLines.map((l) => ({ amountExVat: Number(l.amountExVat) })),
        vatRateBps,
      );

      const result = await ctx.run(async (tx) => {
        const paymentDetails = await resolvePaymentDetails(tx, {
          paymentAccountId: paymentAccountId || null,
          paymentBank: null,
        });
        const branding = await resolveInvoicePdfBranding(ctx.organizationId);
        const pdfBytes = await generateAccountsInvoicePdf({
          kind: 'invoice',
          documentNumber: previewNumber,
          clientName,
          issueDate,
          dueDate,
          currency,
          vatRateBps,
          status: 'draft',
          notes,
          subtotalExVat,
          vatAmount,
          totalIncVat,
          lines: amountLines,
          paymentDetails,
          branding,
        });
        return pdfBytes;
      });

      return new NextResponse(Buffer.from(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="Invoice-preview.pdf"',
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/accounts/invoices/preview-pdf',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to generate preview PDF.' }, { status: 500 });
    }
  });
}
