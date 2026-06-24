import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { computeInvoiceVatFromLines } from '@/lib/accounts-invoice-totals';
import { generateAccountsInvoicePdf } from '@/lib/accounts-invoice-pdf';
import { reportApiError } from '@/lib/monitoring';
import { resolvePaymentDetails } from '@/lib/payment-accounts';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const cn = await prisma.accountsCreditNote.findUnique({
      where: { id },
      include: {
        client: { select: { name: true } },
        originalInvoice: { select: { invoiceNumber: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!cn) return NextResponse.json({ error: 'Credit note not found' }, { status: 404 });

    const { subtotalExVat, vatAmount, totalIncVat } = computeInvoiceVatFromLines(
      cn.lines,
      cn.vatRateBps,
    );

    const lines = cn.lines.map((l, i) => ({
      lineNo: i + 1,
      item: l.item,
      description: l.description,
      amountExVat: String(l.amountExVat),
    }));

    const paymentDetails = await resolvePaymentDetails(prisma, {
      paymentAccountId: cn.paymentAccountId,
      paymentBank: cn.paymentBank,
    });

    const pdfBytes = await generateAccountsInvoicePdf({
      kind: 'credit_note',
      documentNumber: cn.creditNoteNumber,
      originalInvoiceNumber: cn.originalInvoice.invoiceNumber,
      clientName: cn.client.name,
      issueDate: cn.issueDate.toISOString().slice(0, 10),
      dueDate: null,
      currency: cn.currency,
      vatRateBps: cn.vatRateBps,
      status: 'issued',
      notes: cn.notes,
      subtotalExVat,
      vatAmount,
      totalIncVat,
      lines,
      paymentDetails,
    });

    const q = request.nextUrl.searchParams.get('disposition');
    const isInline = q === 'inline';
    const filename = `Credit-note-${cn.creditNoteNumber}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
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
}
