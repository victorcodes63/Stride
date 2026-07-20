/**
 * Generate a KRA P9A (Tax Deduction Card) PDF for one employee / tax year.
 *
 * Reuses the exact same PDF stack and construction approach as
 * `@/lib/payslip-pdf` (pdf-lib + Stride brand assets/palette). Rendered in
 * landscape A4 to fit the wide P9A monthly table.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { brand, getLogoFileAbsolutePath } from '@/lib/brand';
import { STRIDE_MARK_PNG_SRC } from '@/lib/brand-constants';
import { STRIDE_PALETTE } from '@/lib/stride-palette';
import type { P9Card, P9MonthRow, P9Totals } from '@/lib/p9';

function formatAmount(val: number): string {
  return Number(val).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hexRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return rgb(
    Number.parseInt(h.slice(0, 2), 16) / 255,
    Number.parseInt(h.slice(2, 4), 16) / 255,
    Number.parseInt(h.slice(4, 6), 16) / 255,
  );
}

const CORAL = hexRgb(STRIDE_PALETTE.coral);
const CORAL_DEEP = hexRgb(STRIDE_PALETTE.coralDeep);
const INK = hexRgb(STRIDE_PALETTE.ink);
const INK_MUTED = hexRgb(STRIDE_PALETTE.inkMuted);
const INK_SUBTLE = hexRgb(STRIDE_PALETTE.inkSubtle);
const PAPER = hexRgb(STRIDE_PALETTE.paper);
const PAPER_2 = hexRgb(STRIDE_PALETTE.paper2);
const LINE = hexRgb(STRIDE_PALETTE.line);
const WHITE = rgb(1, 1, 1);

const PNG_CANDIDATES = [
  brand.logoPngPath,
  STRIDE_MARK_PNG_SRC,
  '/brand/stride-mark-192.png',
  '/brand/stride-bolt-white-512.png',
];

const WORDMARK_WHITE_CANDIDATES = [
  '/brand/stride-wordmark-white.png',
  '/brand/stride-wordmark.png',
];

async function embedPngCandidates(doc: PDFDocument, candidates: string[]) {
  for (const candidate of candidates) {
    const abs = candidate.startsWith('/')
      ? resolve(process.cwd(), 'public', candidate.slice(1))
      : getLogoFileAbsolutePath(candidate);
    if (!existsSync(abs) || !/\.png$/i.test(abs)) continue;
    try {
      return await doc.embedPng(readFileSync(abs));
    } catch {
      /* try next */
    }
  }
  return null;
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

function drawCenter(
  page: PDFPage,
  text: string,
  xCenter: number,
  y: number,
  size: number,
  font: PDFFont,
  color: RGB,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xCenter - w / 2, y, size, font, color });
}

/** P9A table columns. `weight` drives proportional width. */
type Column = {
  key: keyof P9MonthRow & keyof P9Totals | 'monthName';
  header: string;
  weight: number;
  money?: boolean;
};

const COLUMNS: Column[] = [
  { key: 'monthName', header: 'Month', weight: 1.5 },
  { key: 'basicSalary', header: 'A\nBasic', weight: 1.25, money: true },
  { key: 'benefits', header: 'B\nBenefits', weight: 1.25, money: true },
  { key: 'valueOfQuarters', header: 'C\nQuarters', weight: 1, money: true },
  { key: 'totalGrossPay', header: 'D\nGross', weight: 1.25, money: true },
  { key: 'e1ThirtyPercentOfBasic', header: 'E1\n30% Basic', weight: 1.1, money: true },
  { key: 'e2ActualContribution', header: 'E2\nNSSF', weight: 1, money: true },
  { key: 'e3FixedCap', header: 'E3\nFixed', weight: 1, money: true },
  { key: 'definedContribution', header: 'E\nAllowed', weight: 1.1, money: true },
  { key: 'shif', header: 'SHIF', weight: 1, money: true },
  { key: 'ahl', header: 'AHL', weight: 1, money: true },
  { key: 'chargeablePay', header: 'F\nChargeable', weight: 1.25, money: true },
  { key: 'taxCharged', header: 'G\nTax Chgd', weight: 1.1, money: true },
  { key: 'personalRelief', header: 'H\nRelief', weight: 1, money: true },
  { key: 'payeTax', header: 'J\nPAYE', weight: 1.15, money: true },
];

export async function generateP9Pdf(card: P9Card, year: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 28;
  const contentWidth = width - margin * 2;

  // Full-bleed paper wash
  page.drawRectangle({ x: 0, y: 0, width, height, color: PAPER });

  // ── Coral letterhead ──────────────────────────────────────────────
  const headerH = 84;
  page.drawRectangle({ x: 0, y: height - headerH, width, height: headerH, color: CORAL });
  page.drawRectangle({ x: 0, y: height - headerH, width, height: 4, color: CORAL_DEEP });

  const mark = await embedPngCandidates(doc, PNG_CANDIDATES);
  const wordmark = await embedPngCandidates(doc, WORDMARK_WHITE_CANDIDATES);
  const markSize = 30;
  const markX = margin;
  const markY = height - 44 - markSize / 2;
  if (mark) {
    page.drawCircle({
      x: markX + markSize / 2,
      y: markY + markSize / 2,
      size: markSize / 2 + 2,
      color: WHITE,
    });
    page.drawImage(mark, { x: markX, y: markY, width: markSize, height: markSize });
  }

  const brandX = mark ? markX + markSize + 12 : margin;
  const topRowY = height - 40;
  const bottomRowY = height - 60;
  if (wordmark) {
    const wmH = 18;
    const wmW = (wordmark.width / wordmark.height) * wmH;
    page.drawImage(wordmark, { x: brandX, y: topRowY - 4, width: wmW, height: wmH });
  } else {
    page.drawText(brand.wordmark.toLowerCase(), {
      x: brandX,
      y: topRowY,
      size: 20,
      font: helveticaBold,
      color: WHITE,
    });
  }
  page.drawText('Tax Deduction Card (P9A)', {
    x: brandX,
    y: bottomRowY,
    size: 10,
    font: helvetica,
    color: WHITE,
  });
  drawRight(page, `Tax Year ${year}`, width - margin, topRowY + 2, 13, helveticaBold, WHITE);
  drawRight(page, 'Kenya Revenue Authority', width - margin, bottomRowY, 9, helvetica, rgb(1, 0.95, 0.93));

  let y = height - headerH - 22;

  // ── Employer / Employee info card ─────────────────────────────────
  const m = card.meta;
  const infoRows: [string, string][] = [
    ['Employer', m.employerName],
    ['Employer PIN', m.employerPin || '—'],
    ['Employee', m.employeeName + (m.employeeNumber ? ` (${m.employeeNumber})` : '')],
    ['Employee PIN', m.employeePin || '—'],
  ];
  const boxPadding = 12;
  const rowH = 16;
  const half = infoRows.length / 2;
  const infoBoxH = half * rowH + boxPadding * 2;
  page.drawRectangle({
    x: margin,
    y: y - infoBoxH,
    width: contentWidth,
    height: infoBoxH,
    color: PAPER_2,
    borderColor: LINE,
    borderWidth: 1,
  });
  page.drawRectangle({ x: margin, y: y - infoBoxH, width: 3, height: infoBoxH, color: CORAL });

  const colGap = contentWidth / 2;
  infoRows.forEach(([label, value], i) => {
    const col = i < half ? 0 : 1;
    const rowInCol = i % half;
    const baseX = margin + boxPadding + 6 + col * colGap;
    const rowY = y - boxPadding - 12 - rowInCol * rowH;
    page.drawText(label, { x: baseX, y: rowY, size: 8, font: helveticaBold, color: INK_SUBTLE });
    page.drawText(value, { x: baseX + 78, y: rowY, size: 9, font: helvetica, color: INK });
  });
  y -= infoBoxH + 18;

  // ── Monthly table ─────────────────────────────────────────────────
  const totalWeight = COLUMNS.reduce((acc, c) => acc + c.weight, 0);
  const unit = contentWidth / totalWeight;
  const colX: number[] = [];
  let acc = margin;
  for (const c of COLUMNS) {
    colX.push(acc);
    acc += c.weight * unit;
  }
  const tableRight = width - margin;
  const cellPad = 3;

  const headerRowH = 22;
  const bodyRowH = 15.5;

  // Header band
  page.drawRectangle({
    x: margin,
    y: y - headerRowH,
    width: contentWidth,
    height: headerRowH,
    color: CORAL,
  });
  COLUMNS.forEach((c, i) => {
    const x0 = colX[i];
    const x1 = i + 1 < colX.length ? colX[i + 1] : tableRight;
    const cx = (x0 + x1) / 2;
    const lines = c.header.split('\n');
    if (lines.length === 1) {
      drawCenter(page, lines[0], cx, y - 14, 7, helveticaBold, WHITE);
    } else {
      drawCenter(page, lines[0], cx, y - 9, 7, helveticaBold, WHITE);
      drawCenter(page, lines[1], cx, y - 18, 6.5, helvetica, rgb(1, 0.95, 0.93));
    }
  });
  y -= headerRowH;

  const drawCell = (
    text: string,
    colIndex: number,
    rowY: number,
    font: PDFFont,
    size: number,
    color: RGB,
    align: 'left' | 'right' | 'center',
  ) => {
    const x0 = colX[colIndex];
    const x1 = colIndex + 1 < colX.length ? colX[colIndex + 1] : tableRight;
    if (align === 'right') drawRight(page, text, x1 - cellPad, rowY, size, font, color);
    else if (align === 'center') drawCenter(page, text, (x0 + x1) / 2, rowY, size, font, color);
    else page.drawText(text, { x: x0 + cellPad, y: rowY, size, font, color });
  };

  const drawDataRow = (
    row: P9MonthRow | (P9Totals & { monthName: string }),
    isTotals: boolean,
    zebra: boolean,
  ) => {
    if (zebra && !isTotals) {
      page.drawRectangle({ x: margin, y: y - bodyRowH, width: contentWidth, height: bodyRowH, color: PAPER_2 });
    }
    if (isTotals) {
      page.drawRectangle({ x: margin, y: y - bodyRowH, width: contentWidth, height: bodyRowH, color: CORAL_DEEP });
    }
    const font = isTotals ? helveticaBold : helvetica;
    const size = 6.8;
    const color = isTotals ? WHITE : INK_MUTED;
    const rowY = y - bodyRowH + 5;
    COLUMNS.forEach((c, i) => {
      if (c.key === 'monthName') {
        drawCell(
          (row as { monthName: string }).monthName,
          i,
          rowY,
          isTotals ? helveticaBold : helveticaBold,
          size,
          isTotals ? WHITE : INK,
          'left',
        );
        return;
      }
      const raw = (row as unknown as Record<string, number>)[c.key as string] ?? 0;
      const text = c.money ? formatAmount(raw) : String(raw);
      drawCell(text, i, rowY, font, size, color, 'right');
    });
    // bottom border
    page.drawLine({
      start: { x: margin, y: y - bodyRowH },
      end: { x: tableRight, y: y - bodyRowH },
      thickness: 0.4,
      color: LINE,
    });
    y -= bodyRowH;
  };

  card.rows.forEach((row, i) => drawDataRow(row, false, i % 2 === 1));
  drawDataRow({ ...card.totals, monthName: 'TOTAL' }, true, false);

  // Column separators (light verticals across the table body + header)
  const tableTop = height - headerH - 22 - infoBoxH - 18;
  const tableBottom = y;
  for (let i = 1; i < colX.length; i++) {
    page.drawLine({
      start: { x: colX[i], y: tableTop - headerRowH },
      end: { x: colX[i], y: tableBottom },
      thickness: 0.3,
      color: LINE,
    });
  }

  y -= 14;

  // ── Legend / notes ────────────────────────────────────────────────
  const notes = [
    'E = Defined Contribution Retirement Scheme (lowest of E1 30% of basic, E2 actual NSSF, E3 fixed KES 30,000/month).',
    'F Chargeable Pay = Gross − E − SHIF − AHL.  G Tax Charged is PAYE before relief; J PAYE is tax after personal relief.',
  ];
  for (const note of notes) {
    page.drawText(note, { x: margin, y, size: 7, font: helvetica, color: INK_SUBTLE });
    y -= 10;
  }

  // ── Footer ────────────────────────────────────────────────────────
  const footerY = 26;
  page.drawLine({
    start: { x: margin, y: footerY + 14 },
    end: { x: width - margin, y: footerY + 14 },
    thickness: 0.75,
    color: LINE,
  });
  page.drawText(`${brand.wordmark} · Confidential tax document`, {
    x: margin,
    y: footerY,
    size: 8,
    font: helvetica,
    color: INK_SUBTLE,
  });
  const footerRight =
    [brand.orgName, brand.contactAddress].filter(Boolean).join(' · ') || card.meta.employerName;
  drawRight(page, footerRight, width - margin, footerY, 8, helvetica, INK_SUBTLE);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
