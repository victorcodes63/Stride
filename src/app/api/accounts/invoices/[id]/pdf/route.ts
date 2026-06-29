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
      const result = await ctx.run(async (tx) => {
        const inv = await tx.accountsInvoice.findFirst({
          where: ctx.where({ id }),
          include: {
            accountsClient: { select: { name: true } },
            lines: { orderBy: { sortOrder: 'asc' } },
          },
        });
        if (!inv) return null;

        const { subtotalExVat, vatAmount, totalIncVat: computedTotalIncVat } = computeInvoiceVatFromLines(
          inv.lines,
          inv.vatRateBps,
        );
        const totalIncVat =
          inv.totalOverrideIncVat != null ? Number(inv.totalOverrideIncVat) : computedTotalIncVat;

        const lines = inv.lines.map((l, i) => ({
          lineNo: i + 1,
          item: l.item,
          description: l.description,
          amountExVat: String(l.amountExVat),
        }));

        const paymentDetails = await resolvePaymentDetails(tx, {
          paymentAccountId: inv.paymentAccountId,
          paymentBank: inv.paymentBank,
        });

        const branding = await resolveInvoicePdfBranding(ctx.organizationId);

        const pdfBytes = await generateAccountsInvoicePdf({
          kind: 'invoice',
          documentNumber: inv.invoiceNumber,
          clientName: inv.accountsClient.name,
          issueDate: inv.issueDate.toISOString().slice(0, 10),
          dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : null,
          currency: inv.currency,
          vatRateBps: inv.vatRateBps,
          status: inv.status,
          notes: inv.notes,
          subtotalExVat,
          vatAmount,
          totalIncVat,
          lines,
          paymentDetails,
          branding,
        });

        return { pdfBytes, invoiceNumber: inv.invoiceNumber };
      });

      if (!result) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

      const q = request.nextUrl.searchParams.get('disposition');
      const isInline = q === 'inline';
      const filename = `Invoice-${result.invoiceNumber}.pdf`;

      return new NextResponse(Buffer.from(result.pdfBytes), {
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
        route: 'GET /api/accounts/invoices/[id]/pdf',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to generate PDF.' }, { status: 500 });
    }
  });
}
