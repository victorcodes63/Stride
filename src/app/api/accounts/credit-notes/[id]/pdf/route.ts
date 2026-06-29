import { NextRequest, NextResponse } from 'next/server';
import { withAccountsTenant } from '@/lib/accounts-tenant-api';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import { generateAccountsInvoicePdf } from '@/lib/accounts-invoice-pdf';
import { reportApiError } from '@/lib/monitoring';
import { resolvePaymentDetails } from '@/lib/payment-accounts';
import { resolveInvoicePdfBranding } from '@/lib/invoice-setup';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  return withAccountsTenant(request, async (ctx) => {
    try {
      const cn = await ctx.run(async (tx) => {
        const row = await tx.accountsCreditNote.findFirst({
          where: ctx.where({ id }),
          include: {
            client: { select: { name: true } },
            originalInvoice: { select: { invoiceNumber: true } },
            lines: { orderBy: { sortOrder: 'asc' } },
          },
        });
        if (!row) return null;

        const { subtotalExVat, vatAmount, totalIncVat } = computeInvoiceVatFromLines(
          row.lines,
          row.vatRateBps,
        );

        const lines = row.lines.map((l, i) => ({
          lineNo: i + 1,
          item: l.item,
          description: l.description,
          amountExVat: String(l.amountExVat),
        }));

        const paymentDetails = await resolvePaymentDetails(tx, {
          paymentAccountId: row.paymentAccountId,
          paymentBank: row.paymentBank,
        });

        const branding = await resolveInvoicePdfBranding(ctx.organizationId);

        const pdfBytes = await generateAccountsInvoicePdf({
          kind: 'credit_note',
          documentNumber: row.creditNoteNumber,
          originalInvoiceNumber: row.originalInvoice.invoiceNumber,
          clientName: row.client.name,
          issueDate: row.issueDate.toISOString().slice(0, 10),
          dueDate: null,
          currency: row.currency,
          vatRateBps: row.vatRateBps,
          status: 'issued',
          notes: row.notes,
          subtotalExVat,
          vatAmount,
          totalIncVat,
          lines,
          paymentDetails,
          branding,
        });

        return { pdfBytes, creditNoteNumber: row.creditNoteNumber };
      });

      if (!cn) return NextResponse.json({ error: 'Credit note not found' }, { status: 404 });

      const q = request.nextUrl.searchParams.get('disposition');
      const isInline = q === 'inline';
      const filename = `Credit-note-${cn.creditNoteNumber}.pdf`;

      return new NextResponse(Buffer.from(cn.pdfBytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': isInline
            ? `inline; filename="${filename}"`
            : `attachment; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/accounts/credit-notes/[id]/pdf',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to generate PDF.' }, { status: 500 });
    }
  });
}
