/**
 * Accounts sales invoice PDF (A4).
 * Supports pre-printed letterhead (blank top margin) or embedded company logo + identity block.
 */

import { PDFDocument, PDFPage, StandardFonts, rgb, type RGB } from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';
import type { PaymentAccountDetails } from '@/lib/payment-accounts';
import type { InvoiceLetterheadMode, InvoicePdfBranding } from '@/lib/invoice-setup';
import { embedImageFromUrl } from '@/lib/pdf-embed-image';
import { DEFAULT_PRIMARY_COLOR, sanitizeHexColor } from '@/lib/brand-theme';

export type AccountsInvoicePdfLine = {
  lineNo: number;
  item: string;
  description: string | null;
  amountExVat: string;
};

export type AccountsInvoicePdfKind = 'invoice' | 'credit_note';

export type AccountsInvoicePdfInput = {
  kind?: AccountsInvoicePdfKind;
  documentNumber: number;
  originalInvoiceNumber?: number | null;
  clientName: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  vatRateBps: number;
  status: string;
  notes: string | null;
  subtotalExVat: number;
  vatAmount: number;
  totalIncVat: number;
  lines: AccountsInvoicePdfLine[];
  paymentDetails: PaymentAccountDetails;
  branding?: Partial<InvoicePdfBranding>;
};

const GRAY_700 = rgb(55 / 255, 55 / 255, 55 / 255);
const GRAY_600 = rgb(82 / 255, 82 / 255, 82 / 255);
const GRAY_500 = rgb(115 / 255, 115 / 255, 115 / 255);
const LIGHT_BG = rgb(249 / 255, 250 / 255, 251 / 255);
const BORDER = rgb(229 / 255, 229 / 255, 229 / 255);
const HEADER_BG = rgb(243 / 255, 244 / 255, 246 / 255);

const PREPRINTED_TOP_INSET_PT = 72;
const GAP_BEFORE_PAYMENT_DETAILS_PT = 48;
const TABLE_LINE_HEIGHT_PT = 12;
const TABLE_ROW_PAD_PT = 10;
const TABLE_HEAD_HEIGHT_PT = 24;

function hexToRgb(hex: string): RGB {
  const value = sanitizeHexColor(hex, DEFAULT_PRIMARY_COLOR).replace('#', '');
  const n = Number.parseInt(value, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function fmt(n: number, currency: string) {
  return `${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const linesOut: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else {
      if (cur) linesOut.push(cur);
      cur = w.length > maxChars ? `${w.slice(0, maxChars)}…` : w;
    }
  }
  if (cur) linesOut.push(cur);
  return linesOut.length ? linesOut : [''];
}

function drawTextRight(
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

function resolveBranding(input?: Partial<InvoicePdfBranding>) {
  const letterheadMode: InvoiceLetterheadMode = input?.letterheadMode ?? 'preprinted';
  return {
    legalName: input?.legalName?.trim() ?? '',
    address: input?.address?.trim() ?? '',
    logoUrl: input?.logoUrl?.trim() ?? '',
    documentFooter: input?.documentFooter?.trim() ?? '',
    primaryColor: hexToRgb(input?.primaryColor ?? DEFAULT_PRIMARY_COLOR),
    vatPin: input?.vatPin?.trim() ?? '',
    letterheadMode,
    topInset: letterheadMode === 'embedded_logo' ? 16 : PREPRINTED_TOP_INSET_PT,
  };
}

async function drawEmbeddedLetterhead(
  doc: PDFDocument,
  page: PDFPage,
  yTop: number,
  margin: number,
  contentW: number,
  branding: ReturnType<typeof resolveBranding>,
  helvetica: PDFFont,
  helveticaBold: PDFFont,
): Promise<number> {
  const logoMaxW = 96;
  const logoMaxH = 48;
  const textX = margin + logoMaxW + 16;
  const textW = contentW - logoMaxW - 16;
  const textChars = Math.max(20, Math.floor(textW / 5.5));

  let logoH = 0;
  const logo = branding.logoUrl ? await embedImageFromUrl(doc, branding.logoUrl) : null;
  if (logo) {
    const scale = Math.min(logoMaxW / logo.width, logoMaxH / logo.height, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    page.drawImage(logo, { x: margin, y: yTop - h, width: w, height: h });
    logoH = h;
  }

  let ty = yTop - 12;
  if (branding.legalName) {
    const nameLines = wrapText(branding.legalName, textChars);
    for (const line of nameLines) {
      page.drawText(line, { x: textX, y: ty, size: 11, font: helveticaBold, color: branding.primaryColor });
      ty -= 13;
    }
  }

  if (branding.address) {
    for (const line of wrapText(branding.address, textChars)) {
      page.drawText(line, { x: textX, y: ty, size: 8, font: helvetica, color: GRAY_600 });
      ty -= 11;
    }
  }

  if (branding.vatPin) {
    page.drawText(`VAT PIN: ${branding.vatPin}`, {
      x: textX,
      y: ty,
      size: 8,
      font: helvetica,
      color: GRAY_600,
    });
    ty -= 11;
  }

  const textBottom = ty;
  const blockBottom = Math.min(textBottom, yTop - logoH) - 14;
  page.drawLine({
    start: { x: margin, y: blockBottom },
    end: { x: margin + contentW, y: blockBottom },
    thickness: 0.5,
    color: BORDER,
  });

  return yTop - blockBottom + 14;
}

function drawDocumentFooter(
  pages: PDFPage[],
  footerText: string,
  margin: number,
  helvetica: PDFFont,
) {
  if (!footerText.trim()) return;
  const lines = wrapText(footerText, 90);
  for (const page of pages) {
    const { height } = page.getSize();
    let fy = margin - 4;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!;
      const w = helvetica.widthOfTextAtSize(line, 7);
      page.drawText(line, {
        x: page.getSize().width / 2 - w / 2,
        y: fy,
        size: 7,
        font: helvetica,
        color: GRAY_500,
      });
      fy += 9;
    }
    void height;
  }
}

export async function generateAccountsInvoicePdf(data: AccountsInvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pageSize: [number, number] = [595, 842];
  const firstPage = doc.addPage(pageSize);
  const pageHeight = firstPage.getSize().height;
  const width = firstPage.getSize().width;

  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 54;
  const contentW = width - margin * 2;
  const bank = data.paymentDetails;
  const docKind = data.kind ?? 'invoice';
  const isCredit = docKind === 'credit_note';
  const branding = resolveBranding(data.branding);
  const PRIMARY = branding.primaryColor;
  const topInset = branding.topInset;

  const ensureSpace = (
    pageRef: { page: PDFPage; y: number },
    height: number,
  ) => {
    if (pageRef.y - height >= margin + 24) return;
    pageRef.page = doc.addPage(pageSize);
    pageRef.y = pageHeight - margin - topInset;
  };

  let startY = pageHeight - margin - topInset;
  if (branding.letterheadMode === 'embedded_logo') {
    const headerTop = pageHeight - margin;
    const used = await drawEmbeddedLetterhead(
      doc,
      firstPage,
      headerTop,
      margin,
      contentW,
      branding,
      helvetica,
      helveticaBold,
    );
    startY = headerTop - used - 8;
  }

  const cursor = { page: firstPage, y: startY };
  const vatPct = data.vatRateBps / 100;

  const drawLineH = (y: number, x0: number, x1: number) => {
    cursor.page.drawLine({
      start: { x: x0, y },
      end: { x: x1, y },
      thickness: 0.5,
      color: BORDER,
    });
  };

  const metaW = Math.min(220, contentW * 0.38);
  const billW = contentW - metaW - 24;
  const metaX = margin + billW + 24;
  const headerTop = cursor.y;

  const titleText = isCredit ? 'CREDIT NOTE' : 'INVOICE';
  cursor.page.drawText(titleText, {
    x: margin,
    y: headerTop - 22,
    size: 18,
    font: helveticaBold,
    color: PRIMARY,
  });

  const metaRight = metaX + metaW;
  const metaRows: [string, string][] = isCredit
    ? [
        ['Credit note no.', String(data.documentNumber)],
        ...(data.originalInvoiceNumber != null
          ? [['Original invoice no.', String(data.originalInvoiceNumber)] as [string, string]]
          : []),
        ['Issue date', data.issueDate],
      ]
    : [
        ['Invoice no.', String(data.documentNumber)],
        ['Issue date', data.issueDate],
        ['Due date', data.dueDate ?? '—'],
      ];

  if (branding.vatPin && branding.letterheadMode === 'preprinted') {
    metaRows.push(['VAT PIN', branding.vatPin]);
  }

  let my = headerTop - 24;
  for (const [label, value] of metaRows) {
    cursor.page.drawText(label, { x: metaX, y: my, size: 8, font: helvetica, color: GRAY_500 });
    drawTextRight(cursor.page, value, metaRight, my, 9, helveticaBold, PRIMARY);
    my -= 14;
  }

  cursor.page.drawText(isCredit ? 'Credit to' : 'Invoice to', {
    x: margin,
    y: headerTop - 78,
    size: 8,
    font: helveticaBold,
    color: GRAY_500,
  });

  const clientLines = wrapText(data.clientName, Math.max(20, Math.floor(billW / 5.5)));
  let hy = headerTop - 92;
  for (const line of clientLines) {
    cursor.page.drawText(line, { x: margin, y: hy, size: 11, font: helveticaBold, color: PRIMARY });
    hy -= 13;
  }

  const headerBottom = Math.min(hy, my) - 12;
  cursor.y = headerBottom;

  if (data.notes?.trim()) {
    const noteLines = wrapText(data.notes.trim(), Math.max(24, Math.floor(contentW / 5)));
    ensureSpace(cursor, 20 + noteLines.length * 11);
    cursor.page.drawText('Notes', {
      x: margin,
      y: cursor.y,
      size: 8,
      font: helveticaBold,
      color: GRAY_500,
    });
    cursor.y -= 12;
    for (const nl of noteLines) {
      cursor.page.drawText(nl, { x: margin, y: cursor.y, size: 9, font: helvetica, color: GRAY_600 });
      cursor.y -= 11;
    }
    cursor.y -= 8;
  }

  cursor.page.drawText('Line items', {
    x: margin,
    y: cursor.y,
    size: 11,
    font: helveticaBold,
    color: PRIMARY,
  });
  cursor.y -= 24;

  const colNumW = 36;
  const colAmtW = 100;
  const descX = margin + colNumW + 10;
  const amtRight = margin + contentW;
  const descW = amtRight - colAmtW - descX - 8;
  const descChars = Math.max(24, Math.floor(descW / 5.2));
  const lineH = TABLE_LINE_HEIGHT_PT;
  const rowPad = TABLE_ROW_PAD_PT;

  type PreparedRow = {
    lineNo: string;
    bodyLines: { text: string; bold: boolean }[];
    amt: string;
    height: number;
  };

  const prepared: PreparedRow[] = [];
  for (const row of data.lines) {
    const itemLines = wrapText(row.item, descChars);
    const rawDesc = row.description?.trim();
    const descLines = rawDesc ? wrapText(rawDesc, descChars) : [];
    const bodyLines: { text: string; bold: boolean }[] = [];
    for (const t of itemLines) bodyLines.push({ text: t, bold: true });
    if (descLines.length) {
      for (const t of descLines) bodyLines.push({ text: t, bold: false });
    }
    const lines = Math.max(bodyLines.length, 1);
    prepared.push({
      lineNo: String(row.lineNo),
      bodyLines: bodyLines.length ? bodyLines : [{ text: '—', bold: false }],
      amt: Number(row.amountExVat).toLocaleString('en-KE', { minimumFractionDigits: 2 }),
      height: lines * lineH + rowPad * 2,
    });
  }

  const theadH = TABLE_HEAD_HEIGHT_PT;
  const tbodyH = prepared.reduce((s, r) => s + r.height, 0);
  const tableH = theadH + tbodyH;

  ensureSpace(cursor, tableH + 36);
  const tTop = cursor.y;
  const tBot = tTop - tableH;

  cursor.page.drawRectangle({
    x: margin,
    y: tBot,
    width: contentW,
    height: tableH,
    borderColor: BORDER,
    borderWidth: 1,
  });

  cursor.page.drawRectangle({
    x: margin,
    y: tTop - theadH,
    width: contentW,
    height: theadH,
    color: HEADER_BG,
    borderColor: BORDER,
    borderWidth: 1,
  });

  const hY = tTop - theadH / 2 - 4;
  cursor.page.drawText('#', { x: margin + 8, y: hY, size: 8, font: helveticaBold, color: GRAY_500 });
  cursor.page.drawText('Description', { x: descX, y: hY, size: 8, font: helveticaBold, color: GRAY_500 });
  drawTextRight(cursor.page, `Amount (${data.currency})`, amtRight - 8, hY, 8, helveticaBold, GRAY_500);

  const xLineNumDesc = margin + colNumW;
  const xLineDescAmt = amtRight - colAmtW;
  cursor.page.drawLine({
    start: { x: xLineNumDesc, y: tTop },
    end: { x: xLineNumDesc, y: tBot },
    thickness: 0.5,
    color: BORDER,
  });
  cursor.page.drawLine({
    start: { x: xLineDescAmt, y: tTop },
    end: { x: xLineDescAmt, y: tBot },
    thickness: 0.5,
    color: BORDER,
  });

  drawLineH(tTop - theadH, margin, margin + contentW);

  let yRow = tTop - theadH;
  for (let ri = 0; ri < prepared.length; ri++) {
    const pr = prepared[ri]!;
    const blockTop = yRow;
    if (ri > 0) drawLineH(blockTop + 12, margin + 2, margin + contentW - 2);

    const n = pr.bodyLines.length;
    const rowBottom = blockTop - pr.height;
    const rowCenterY = (blockTop + rowBottom) / 2;
    const ySingle = rowCenterY - 2;
    const yFirstDesc = rowCenterY - 2 + ((n - 1) * lineH) / 2;

    cursor.page.drawText(pr.lineNo, {
      x: margin + 8,
      y: ySingle,
      size: 9,
      font: helvetica,
      color: GRAY_600,
    });

    let dy = yFirstDesc;
    for (const { text, bold } of pr.bodyLines) {
      cursor.page.drawText(text, {
        x: descX,
        y: dy,
        size: 9,
        font: bold ? helveticaBold : helvetica,
        color: bold ? GRAY_700 : GRAY_600,
      });
      dy -= lineH;
    }

    drawTextRight(cursor.page, pr.amt, amtRight - 8, ySingle, 9, helvetica, GRAY_700);
    yRow = blockTop - pr.height;
  }

  cursor.y = tBot - 28;

  const totalsW = 220;
  const totalsLeft = margin + contentW - totalsW;
  const amtColX = margin + contentW - 8;

  ensureSpace(cursor, 110);

  cursor.page.drawText('Summary', {
    x: totalsLeft,
    y: cursor.y,
    size: 10,
    font: helveticaBold,
    color: PRIMARY,
  });
  cursor.y -= 22;

  const sumLineGap = 8;
  const sumLine = (label: string, value: string, size: number, font: PDFFont, color: RGB) => {
    cursor.page.drawText(label, { x: totalsLeft, y: cursor.y, size, font, color });
    drawTextRight(cursor.page, value, amtColX, cursor.y, size, font, color);
    cursor.y -= size + sumLineGap;
  };

  sumLine(`Subtotal (ex-VAT)`, fmt(data.subtotalExVat, data.currency), 9, helvetica, GRAY_600);
  sumLine(`VAT (${vatPct.toFixed(0)}%)`, fmt(data.vatAmount, data.currency), 9, helvetica, GRAY_600);
  cursor.y -= 4;
  drawLineH(cursor.y + 6, totalsLeft, amtColX);
  cursor.y -= 14;
  sumLine(
    isCredit ? 'Total credit (incl. VAT)' : 'Total (incl. VAT)',
    fmt(data.totalIncVat, data.currency),
    11,
    helveticaBold,
    PRIMARY,
  );

  cursor.y -= GAP_BEFORE_PAYMENT_DETAILS_PT;

  if (isCredit) {
    const noteLines = wrapText(
      'This credit note reduces the amount due on the original invoice. It is issued for corrections to amounts previously billed.',
      Math.max(24, Math.floor(contentW / 5)),
    );
    ensureSpace(cursor, 20 + noteLines.length * 12);
    for (const nl of noteLines) {
      cursor.page.drawText(nl, { x: margin, y: cursor.y, size: 9, font: helvetica, color: GRAY_600 });
      cursor.y -= 11;
    }
    cursor.y -= 8;
  } else {
    const bankLines: string[] = [
      `Bank: ${bank.bank}`,
      `Account number: ${bank.accountNumber}`,
      `Bank code: ${bank.bankCode}`,
      `Branch code: ${bank.branchCode}`,
      `SWIFT: ${bank.swiftCode}`,
    ];
    const bankPad = 14;
    const bankLineStep = 14;
    const bankInnerH = bankLines.length * bankLineStep;
    const bankBoxH = bankPad + bankInnerH + bankPad;

    ensureSpace(cursor, bankBoxH + 28);

    cursor.page.drawText('Payment details', {
      x: margin,
      y: cursor.y,
      size: 10,
      font: helveticaBold,
      color: PRIMARY,
    });
    cursor.y -= 14;

    const bankTop = cursor.y;
    const bankBot = bankTop - bankBoxH;

    cursor.page.drawRectangle({
      x: margin,
      y: bankBot,
      width: contentW,
      height: bankBoxH,
      color: LIGHT_BG,
      borderColor: BORDER,
      borderWidth: 1,
    });

    let by = bankTop - bankPad - 10;
    for (const line of bankLines) {
      cursor.page.drawText(line, {
        x: margin + bankPad,
        y: by,
        size: 9,
        font: helvetica,
        color: GRAY_600,
      });
      by -= bankLineStep;
    }

    cursor.y = bankBot - 8;
  }

  if (branding.documentFooter) {
    drawDocumentFooter(doc.getPages(), branding.documentFooter, margin, helvetica);
  }

  return doc.save();
}

/** Sample invoice PDF for the invoicing setup preview. */
export async function generateSampleAccountsInvoicePdf(
  branding: InvoicePdfBranding,
): Promise<Uint8Array> {
  return generateAccountsInvoicePdf({
    kind: 'invoice',
    documentNumber: 1001,
    clientName: 'Sample Client Ltd',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    currency: 'KES',
    vatRateBps: 1600,
    status: 'draft',
    notes: 'This is a sample invoice for preview purposes.',
    subtotalExVat: 100_000,
    vatAmount: 16_000,
    totalIncVat: 116_000,
    lines: [
      { lineNo: 1, item: 'Professional services', description: 'Consulting — March 2026', amountExVat: '100000' },
    ],
    paymentDetails: {
      purposeTitle: 'Consultancy fees',
      accountName: 'Your Company Ltd',
      bank: 'Sample Bank',
      accountNumber: '1234567890',
      bankCode: '01',
      branchCode: '001',
      swiftCode: 'SAMPLEXXX',
    },
    branding,
  });
}
