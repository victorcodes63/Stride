import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getAccountsAccess } from '@/lib/accounts-access';
import { computeInvoiceVatFromSubtotal } from '@/lib/accounts-invoice-totals';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const access = await getAccountsAccess(user.id, user.role);
  if (!access.hasAccountsAccess) {
    return NextResponse.json({ error: 'No access to Accounts.' }, { status: 403 });
  }

  const clientId = request.nextUrl.searchParams.get('clientId')?.trim() || undefined;

  try {
    const invoices = await prisma.accountsInvoice.findMany({
      where: clientId ? { clientId } : {},
      select: {
        id: true,
        invoiceNumber: true,
        clientId: true,
        issueDate: true,
        dueDate: true,
        taxDate: true,
        currency: true,
        vatRateBps: true,
        totalOverrideIncVat: true,
        status: true,
        notes: true,
        accountsClient: { select: { name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: [{ issueDate: 'desc' }, { invoiceNumber: 'desc' }],
      take: 200,
    });

    const ids = invoices.map((i) => i.id);
    const aggregates =
      ids.length === 0
        ? []
        : await prisma.accountsInvoiceLine.groupBy({
            by: ['invoiceId'],
            where: { invoiceId: { in: ids } },
            _sum: { amountExVat: true },
          });

    const subtotalByInvoice = new Map<string, number>();
    for (const row of aggregates) {
      subtotalByInvoice.set(row.invoiceId, Number(row._sum.amountExVat ?? 0));
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Stride (Accounts)';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Invoices', {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: 'FF043d4a' } },
    });

    const headers = [
      'Invoice #',
      'Client',
      'Client ID',
      'Invoice ID',
      'Issue date',
      'Due date',
      'Tax date',
      'Currency',
      'VAT %',
      'Subtotal (ex-VAT)',
      'VAT amount',
      'Total (incl. VAT)',
      'Line count',
      'Status',
      'Notes',
    ];
    sheet.addRow(headers);
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF043d4a' },
    };
    headerRow.alignment = { wrapText: true, vertical: 'middle' };
    headerRow.height = 20;

    for (const inv of invoices) {
      const subtotalExVat = subtotalByInvoice.get(inv.id) ?? 0;
      const { vatAmount, totalIncVat: computedTotalIncVat } = computeInvoiceVatFromSubtotal(
        subtotalExVat,
        inv.vatRateBps,
      );
      const totalIncVat = inv.totalOverrideIncVat != null ? Number(inv.totalOverrideIncVat) : computedTotalIncVat;
      sheet.addRow([
        inv.invoiceNumber,
        inv.accountsClient.name,
        inv.clientId,
        inv.id,
        inv.issueDate.toISOString().slice(0, 10),
        inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '',
        inv.taxDate ? inv.taxDate.toISOString().slice(0, 10) : '',
        inv.currency,
        inv.vatRateBps / 100,
        subtotalExVat,
        vatAmount,
        totalIncVat,
        inv._count.lines,
        inv.status,
        inv.notes?.trim() ? inv.notes.replace(/\r\n/g, '\n') : '',
      ]);
    }

    sheet.columns = [
      { width: 10 },
      { width: 28 },
      { width: 36 },
      { width: 30 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 10 },
      { width: 8 },
      { width: 18 },
      { width: 14 },
      { width: 18 },
      { width: 11 },
      { width: 10 },
      { width: 40 },
    ];

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    for (let i = 1; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      row.eachCell((cell) => {
        cell.border = borderStyle;
        if (i > 1) {
          cell.alignment = { wrapText: true, vertical: 'top' };
        }
      });
      if (i > 1) {
        row.getCell(9).numFmt = '0.00';
        row.getCell(10).numFmt = '#,##0.00';
        row.getCell(11).numFmt = '#,##0.00';
        row.getCell(12).numFmt = '#,##0.00';
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `invoices-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/accounts/invoices/export',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to export invoices.' }, { status: 500 });
  }
}
