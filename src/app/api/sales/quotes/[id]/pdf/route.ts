import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { lineItemExtendedAmount } from '@/lib/sales/access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const INK = rgb(26 / 255, 23 / 255, 20 / 255);
const CORAL = rgb(1, 84 / 255, 54 / 255);
const GRAY_600 = rgb(82 / 255, 82 / 255, 82 / 255);
const GRAY_500 = rgb(115 / 255, 115 / 255, 115 / 255);
const BORDER = rgb(229 / 255, 229 / 255, 229 / 255);
const PANEL = rgb(250 / 255, 247 / 255, 245 / 255);

const round2 = (n: number) => Math.round(n * 100) / 100;

function fmt(n: number, currency: string) {
  return `${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function shortDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else {
      if (cur) out.push(cur);
      cur = w.length > maxChars ? `${w.slice(0, maxChars)}…` : w;
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

function drawRight(
  page: PDFPage,
  text: string,
  xRight: number,
  y: number,
  size: number,
  font: PDFFont,
  color: RGB,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - w, y, size, font, color });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    try {
      const data = await ctx.run(async (tx) => {
        const found = await tx.salesQuote.findFirst({
          where: { id, organizationId: ctx.organizationId },
          include: {
            accountsClient: { select: { name: true, contactName: true, contactEmail: true } },
            lineItems: { orderBy: { sortOrder: 'asc' } },
          },
        });
        if (!found) return null;
        const org = await tx.organization.findUnique({
          where: { id: ctx.organizationId },
          select: { name: true },
        });
        return { quote: found, orgName: org?.name ?? 'Stride' };
      });
      if (!data) {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 });
      }
      const { quote } = data;

      const currency = quote.currency;
      const rows = quote.lineItems.map((li) => ({
        description: li.description,
        detail: li.isRecurring ? `Recurring · ${li.termMonths ?? 1} mo` : null,
        qty: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
        discountPct: Number(li.discountPct),
        amount: lineItemExtendedAmount({
          quantity: Number(li.quantity),
          unitPrice: Number(li.unitPrice),
          discountPct: Number(li.discountPct),
          isRecurring: li.isRecurring,
          termMonths: li.termMonths,
        }),
      }));

      const subtotal = round2(rows.reduce((s, r) => s + r.amount, 0));
      const discountPct = Math.min(100, Math.max(0, Number(quote.discountPct)));
      const discountAmount = round2((subtotal * discountPct) / 100);
      const netAmount = round2(subtotal - discountAmount);
      const taxAmount = round2((netAmount * Math.max(0, quote.taxRateBps)) / 10000);
      const total = round2(netAmount + taxAmount);

      const orgName = data.orgName;

      const doc = await PDFDocument.create();
      const pageSize: [number, number] = [595, 842];
      const page = doc.addPage(pageSize);
      const width = page.getSize().width;
      const height = page.getSize().height;
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);

      const margin = 54;
      const contentW = width - margin * 2;
      const rightEdge = margin + contentW;

      // Header band
      page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: CORAL });

      let y = height - margin;
      page.drawText('QUOTATION', { x: margin, y: y - 6, size: 22, font: bold, color: INK });
      drawRight(page, orgName, rightEdge, y - 2, 13, bold, CORAL);
      y -= 30;

      const metaRows: [string, string][] = [
        ['Quote no.', `Q-${String(quote.quoteNumber).padStart(4, '0')}`],
        ['Issue date', shortDate(quote.issueDate)],
        ['Valid until', shortDate(quote.validUntil)],
        ['Status', quote.status.toUpperCase()],
      ];
      let my = y;
      for (const [label, value] of metaRows) {
        page.drawText(label, { x: rightEdge - 200, y: my, size: 8, font, color: GRAY_500 });
        drawRight(page, value, rightEdge, my, 9, bold, INK);
        my -= 13;
      }

      // Bill-to block
      page.drawText('Prepared for', { x: margin, y, size: 8, font, color: GRAY_500 });
      y -= 15;
      const clientName = quote.accountsClient?.name ?? 'Prospective client';
      page.drawText(clientName, { x: margin, y, size: 12, font: bold, color: INK });
      y -= 14;
      if (quote.accountsClient?.contactName) {
        page.drawText(quote.accountsClient.contactName, { x: margin, y, size: 9, font, color: GRAY_600 });
        y -= 12;
      }
      if (quote.accountsClient?.contactEmail) {
        page.drawText(quote.accountsClient.contactEmail, { x: margin, y, size: 9, font, color: GRAY_600 });
        y -= 12;
      }

      y = Math.min(y, my) - 16;
      // Title
      for (const line of wrapText(quote.title, Math.floor(contentW / 6))) {
        page.drawText(line, { x: margin, y, size: 13, font: bold, color: INK });
        y -= 16;
      }
      y -= 8;

      // Table header
      const colDescX = margin + 8;
      const colQtyX = rightEdge - 250;
      const colUnitX = rightEdge - 170;
      const colAmtRight = rightEdge - 8;
      page.drawRectangle({ x: margin, y: y - 20, width: contentW, height: 20, color: PANEL });
      const headY = y - 14;
      page.drawText('Description', { x: colDescX, y: headY, size: 8, font: bold, color: GRAY_600 });
      drawRight(page, 'Qty', colQtyX + 24, headY, 8, bold, GRAY_600);
      drawRight(page, 'Unit price', colUnitX + 70, headY, 8, bold, GRAY_600);
      drawRight(page, `Amount (${currency})`, colAmtRight, headY, 8, bold, GRAY_600);
      y -= 20;
      page.drawLine({ start: { x: margin, y }, end: { x: rightEdge, y }, thickness: 0.5, color: BORDER });

      const descChars = Math.max(20, Math.floor((colQtyX - colDescX) / 5.2));
      for (const row of rows) {
        const descLines = wrapText(row.description, descChars);
        const extra = row.detail ? 1 : 0;
        const rowH = Math.max(descLines.length + extra, 1) * 12 + 10;
        if (y - rowH < margin + 120) {
          // Not enough room; move totals to same page anyway (quotes are short).
        }
        const topY = y - 14;
        let dy = topY;
        for (const dl of descLines) {
          page.drawText(dl, { x: colDescX, y: dy, size: 9, font: bold, color: INK });
          dy -= 12;
        }
        if (row.detail) {
          page.drawText(row.detail, { x: colDescX, y: dy, size: 8, font, color: GRAY_500 });
          dy -= 12;
        }
        const discSuffix = row.discountPct > 0 ? ` (-${row.discountPct}%)` : '';
        drawRight(page, String(row.qty), colQtyX + 24, topY, 9, font, GRAY_600);
        drawRight(page, `${fmt(row.unitPrice, '')}`.trim() + discSuffix, colUnitX + 70, topY, 9, font, GRAY_600);
        drawRight(page, fmt(row.amount, ''), colAmtRight, topY, 9, font, INK);
        y -= rowH;
        page.drawLine({ start: { x: margin, y }, end: { x: rightEdge, y }, thickness: 0.4, color: BORDER });
      }

      if (rows.length === 0) {
        page.drawText('No line items on this quote.', { x: colDescX, y: y - 14, size: 9, font, color: GRAY_500 });
        y -= 26;
      }

      // Totals
      y -= 18;
      const totalsLeft = rightEdge - 240;
      const sum = (label: string, value: string, size: number, f: PDFFont, color: RGB) => {
        page.drawText(label, { x: totalsLeft, y, size, font: f, color });
        drawRight(page, value, colAmtRight, y, size, f, color);
        y -= size + 7;
      };
      sum('Subtotal', fmt(subtotal, currency), 9, font, GRAY_600);
      if (discountPct > 0) {
        sum(`Discount (${discountPct}%)`, `- ${fmt(discountAmount, currency)}`, 9, font, GRAY_600);
      }
      sum(`VAT (${(quote.taxRateBps / 100).toFixed(0)}%)`, fmt(taxAmount, currency), 9, font, GRAY_600);
      y -= 2;
      page.drawLine({ start: { x: totalsLeft, y: y + 4 }, end: { x: colAmtRight, y: y + 4 }, thickness: 0.5, color: BORDER });
      y -= 12;
      sum('Total', fmt(total, currency), 12, bold, INK);

      // Notes / terms
      if (quote.notes?.trim()) {
        y -= 16;
        page.drawText('Notes', { x: margin, y, size: 9, font: bold, color: INK });
        y -= 13;
        for (const nl of wrapText(quote.notes.trim(), Math.floor(contentW / 5))) {
          page.drawText(nl, { x: margin, y, size: 8, font, color: GRAY_600 });
          y -= 11;
        }
      }
      if (quote.terms?.trim()) {
        y -= 12;
        page.drawText('Terms & conditions', { x: margin, y, size: 9, font: bold, color: INK });
        y -= 13;
        for (const tl of wrapText(quote.terms.trim(), Math.floor(contentW / 5))) {
          page.drawText(tl, { x: margin, y, size: 8, font, color: GRAY_600 });
          y -= 11;
        }
      }

      // Footer
      const footer = `${orgName} · Quote Q-${String(quote.quoteNumber).padStart(4, '0')} · Generated ${shortDate(new Date())}`;
      const fw = font.widthOfTextAtSize(footer, 7);
      page.drawText(footer, { x: width / 2 - fw / 2, y: margin - 18, size: 7, font, color: GRAY_500 });

      const bytes = await doc.save();
      const filename = `Quote-Q-${String(quote.quoteNumber).padStart(4, '0')}.pdf`;
      const inline = request.nextUrl.searchParams.get('inline') === '1';
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/quotes/[id]/pdf',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to generate quote PDF.' }, { status: 500 });
    }
  });
}
