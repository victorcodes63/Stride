/**
 * Accounts sales invoice PDF (A4).
 * Supports pre-printed letterhead (blank top margin) or embedded company logo + identity block.
 */

import { PDFDocument, PDFPage, StandardFonts, rgb, type RGB } from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';
import type { PaymentAccountDetails } from '@/lib/payment-accounts';
import type { InvoiceLetterheadMode, InvoicePdfBranding } from '@/lib/invoice-setup';
import { resolveInvoicePanelBackground } from '@/lib/invoice-setup';
import { embedImageFromUrl } from '@/lib/pdf-embed-image';
import { DEFAULT_PRIMARY_COLOR, isValidHexColor, sanitizeHexColor } from '@/lib/brand-theme';

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
const BORDER = rgb(229 / 255, 229 / 255, 229 / 255);
const WHITE = rgb(1, 1, 1);
const INK = rgb(26 / 255, 23 / 255, 20 / 255);
const INVOICE_TO_BOX_PAD_PT = 12;

type PdfContrastPalette = {
  isDark: boolean;
  heading: RGB;
  body: RGB;
  muted: RGB;
  border: RGB;
};

function hexLuminance(hex: string): number {
  const value = sanitizeHexColor(hex, '#FFFFFF').replace('#', '');
  const n = Number.parseInt(value, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isDarkHex(hex: string): boolean {
  return hexLuminance(hex) < 140;
}

/** Pick readable text on a coloured panel or header band (or white page when bg is null). */
function resolveContrastOnBackground(
  backgroundHex: string | null,
  accentHex: string,
): PdfContrastPalette {
  const hasBand = Boolean(backgroundHex && isValidHexColor(backgroundHex));
  if (hasBand && isDarkHex(backgroundHex!)) {
    return {
      isDark: true,
      heading: WHITE,
      body: rgb(0.92, 0.92, 0.92),
      muted: rgb(0.78, 0.78, 0.78),
      border: rgb(0.42, 0.42, 0.42),
    };
  }

  const accent = hexToRgb(accentHex);
  const heading = !hasBand && hexLuminance(accentHex) >= 200 ? INK : accent;

  return {
    isDark: false,
    heading,
    body: GRAY_600,
    muted: GRAY_500,
    border: BORDER,
  };
}

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
  const headerBgHex = input?.headerBackgroundColor?.trim() ?? '';
  const hasHeaderBand = Boolean(headerBgHex && isValidHexColor(headerBgHex));
  const panelHex = resolveInvoicePanelBackground(input?.panelBackgroundColor?.trim() ?? '');
  const accentHex = sanitizeHexColor(input?.primaryColor ?? DEFAULT_PRIMARY_COLOR, DEFAULT_PRIMARY_COLOR);
  const headerContrast = resolveContrastOnBackground(
    hasHeaderBand ? headerBgHex : null,
    accentHex,
  );
  const panelContrast = resolveContrastOnBackground(panelHex, accentHex);

  return {
    legalName: input?.legalName?.trim() ?? '',
    address: input?.address?.trim() ?? '',
    logoUrl: input?.logoUrl?.trim() ?? '',
    documentFooter: input?.documentFooter?.trim() ?? '',
    primaryColor: hexToRgb(accentHex),
    accentHex,
    headerBackgroundColor: hasHeaderBand ? hexToRgb(headerBgHex) : null,
    headerBackgroundHex: hasHeaderBand ? headerBgHex : null,
    headerContrast,
    panelBackgroundColor: hexToRgb(panelHex),
    panelBackgroundHex: panelHex,
    panelContrast,
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
  const logoMaxH = 56;
  const rightEdge = margin + contentW;
  const textChars = Math.max(24, Math.floor(contentW * 0.42 / 5.5));
  const contrast = branding.headerContrast;
  const titleColor = contrast.heading;
  const bodyColor = contrast.body;
  const ruleColor = contrast.border;

  let logoH = 0;
  let logoW = 0;
  const logo = branding.logoUrl ? await embedImageFromUrl(doc, branding.logoUrl) : null;
  if (logo) {
    const scale = Math.min(logoMaxW / logo.width, logoMaxH / logo.height, 1);
    logoW = logo.width * scale;
    logoH = logo.height * scale;
  }

  const nameLines = branding.legalName ? wrapText(branding.legalName, textChars) : [];
  const addressLines = branding.address ? wrapText(branding.address, textChars) : [];
  const vatLineCount = branding.vatPin ? 1 : 0;
  const textBlockH =
    nameLines.length * 13 + addressLines.length * 11 + vatLineCount * 11 + (nameLines.length ? 0 : 0);
  const blockH = Math.max(logoH, textBlockH, 48);
  const bandPad = 14;
  const bandTop = yTop + bandPad;
  const bandBottom = bandTop - blockH - bandPad;
  const bandHeight = bandTop - bandBottom;

  if (branding.headerBackgroundColor) {
    page.drawRectangle({
      x: margin,
      y: bandBottom,
      width: contentW,
      height: bandHeight,
      color: branding.headerBackgroundColor,
    });
  }

  const logoY = bandTop - 12 - logoH;
  if (logo) {
    page.drawImage(logo, { x: margin, y: logoY, width: logoW, height: logoH });
  }

  let ty = bandTop - 12;
  for (const line of nameLines) {
    drawTextRight(page, line, rightEdge, ty, 11, helveticaBold, titleColor);
    ty -= 13;
  }
  for (const line of addressLines) {
    drawTextRight(page, line, rightEdge, ty, 8, helvetica, bodyColor);
    ty -= 11;
  }
  if (branding.vatPin) {
    drawTextRight(page, `VAT PIN: ${branding.vatPin}`, rightEdge, ty, 8, helvetica, bodyColor);
    ty -= 11;
  }

  const blockBottom = bandBottom + 4;
  page.drawLine({
    start: { x: margin, y: blockBottom },
    end: { x: rightEdge, y: blockBottom },
    thickness: 0.5,
    color: ruleColor,
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
  const PANEL_BG = branding.panelBackgroundColor;
  const panelText = branding.panelContrast;
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

  const headerBottom = my - 12;
  cursor.y = headerBottom;

  const invoiceToLabel = isCredit ? 'Credit to' : 'Invoice to';
  const clientLines = wrapText(data.clientName, Math.max(20, Math.floor(contentW / 5.5)));
  const invoiceToBoxH =
    INVOICE_TO_BOX_PAD_PT * 2 + 10 + Math.max(clientLines.length, 1) * 13;

  ensureSpace(cursor, invoiceToBoxH + 16);
  const invoiceToTop = cursor.y;
  const invoiceToBot = invoiceToTop - invoiceToBoxH;

  cursor.page.drawRectangle({
    x: margin,
    y: invoiceToBot,
    width: contentW,
    height: invoiceToBoxH,
    color: PANEL_BG,
    borderColor: panelText.border,
    borderWidth: 0.5,
  });

  cursor.page.drawText(invoiceToLabel, {
    x: margin + INVOICE_TO_BOX_PAD_PT,
    y: invoiceToTop - INVOICE_TO_BOX_PAD_PT - 8,
    size: 8,
    font: helveticaBold,
    color: panelText.muted,
  });

  let clientY = invoiceToTop - INVOICE_TO_BOX_PAD_PT - 22;
  for (const line of clientLines) {
    cursor.page.drawText(line, {
      x: margin + INVOICE_TO_BOX_PAD_PT,
      y: clientY,
      size: 11,
      font: helveticaBold,
      color: panelText.heading,
    });
    clientY -= 13;
  }

  cursor.y = invoiceToBot - 16;

  if (data.notes?.trim()) {
    const noteLines = wrapText(data.notes.trim(), Math.max(24, Math.floor(contentW / 5)));
    ensureSpace(cursor, 12 + noteLines.length * 11);
    for (const nl of noteLines) {
      cursor.page.drawText(nl, { x: margin, y: cursor.y, size: 9, font: helvetica, color: GRAY_600 });
      cursor.y -= 11;
    }
    cursor.y -= 8;
  }

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
    color: PANEL_BG,
    borderColor: BORDER,
    borderWidth: 1,
  });

  const hY = tTop - theadH / 2 - 4;
  cursor.page.drawText('#', { x: margin + 8, y: hY, size: 8, font: helveticaBold, color: panelText.muted });
  cursor.page.drawText('Description', { x: descX, y: hY, size: 8, font: helveticaBold, color: panelText.muted });
  drawTextRight(
    cursor.page,
    `Amount (${data.currency})`,
    amtRight - 8,
    hY,
    8,
    helveticaBold,
    panelText.muted,
  );

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
      color: PANEL_BG,
      borderColor: panelText.border,
      borderWidth: 1,
    });

    let by = bankTop - bankPad - 10;
    for (const line of bankLines) {
      cursor.page.drawText(line, {
        x: margin + bankPad,
        y: by,
        size: 9,
        font: helvetica,
        color: panelText.body,
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
