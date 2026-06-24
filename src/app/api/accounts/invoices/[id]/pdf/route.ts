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
    const inv = await prisma.accountsInvoice.findUnique({
      where: { id },
      include: {
        accountsClient: { select: { name: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

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

    const paymentDetails = await resolvePaymentDetails(prisma, {
      paymentAccountId: inv.paymentAccountId,
      paymentBank: inv.paymentBank,
    });

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
    });

    const q = request.nextUrl.searchParams.get('disposition');
    const isInline = q === 'inline';

    const filename = `Invoice-${inv.invoiceNumber}.pdf`;

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
      route: 'GET /api/accounts/invoices/[id]/pdf',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to generate PDF.' }, { status: 500 });
  }
}
