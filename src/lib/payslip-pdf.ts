/**
 * Generate payslip PDF for ESS download and email attachment.
 * Stride-branded letterhead (coral band + mark) — pdf-lib requires PNG, not SVG.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { brand, getLogoFileAbsolutePath } from '@/lib/brand';
import { STRIDE_MARK_PNG_SRC } from '@/lib/brand-constants';
import { STRIDE_PALETTE } from '@/lib/stride-palette';

export interface PayslipPdfData {
  employeeName: string;
  employeeNumber?: string | null;
  clientName: string;
  departmentName?: string | null;
  basicPay: string;
  allowances: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  grossPay: string;
  /** Shown on payslip only when > 0 */
  leavePay?: string;
  paye: string;
  nssf: string;
  nhif: string;
  ahl: string;
  /** Employer NITA levy (flat/month); shown for transparency, not deducted from net pay. */
  employerNita?: string;
  netPay: string;
  biweekly?: boolean;
  period1Gross?: string;
  period2Gross?: string;
  biweeklyAttendance?: { period1: string[]; period2: string[] };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatAmount(val: string | number): string {
  return Number(val).toLocaleString('en-KE', { minimumFractionDigits: 2 });
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

/** White wordmark for coral letterhead — pdf-lib cannot embed the SVG asset. */
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

async function embedStrideMark(doc: PDFDocument) {
  return embedPngCandidates(doc, PNG_CANDIDATES);
}

async function embedStrideWordmark(doc: PDFDocument) {
  return embedPngCandidates(doc, WORDMARK_WHITE_CANDIDATES);
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

export async function generatePayslipPdf(
  data: PayslipPdfData,
  month: number,
  year: number,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const monthName = MONTH_NAMES[month - 1] ?? String(month);
  const fmt = (v: string | number) => `KES ${formatAmount(v)}`;
  const periodLabel = `${monthName} ${year}`;

  const margin = 48;
  const contentWidth = width - margin * 2;
  let y = height;

  // Full-bleed paper wash (subtle warm Stride paper, not stark white)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: PAPER,
  });

  // ── Coral letterhead ──────────────────────────────────────────────
  const headerH = 108;
  page.drawRectangle({
    x: 0,
    y: height - headerH,
    width,
    height: headerH,
    color: CORAL,
  });
  // Deep coral accent bar at bottom of header
  page.drawRectangle({
    x: 0,
    y: height - headerH,
    width,
    height: 4,
    color: CORAL_DEEP,
  });

  const mark = await embedStrideMark(doc);
  const wordmark = await embedStrideWordmark(doc);
  const markSize = 36;
  const markX = margin;
  const markY = height - 52 - markSize / 2;
  if (mark) {
    // White disc behind mark so coral bolt / dark marks stay crisp on coral band
    page.drawCircle({
      x: markX + markSize / 2,
      y: markY + markSize / 2,
      size: markSize / 2 + 2,
      color: WHITE,
    });
    page.drawImage(mark, {
      x: markX,
      y: markY,
      width: markSize,
      height: markSize,
    });
  }

  const brandX = mark ? markX + markSize + 12 : margin;
  // Shared rows: top = wordmark + period · bottom = "Employee payslip" + company
  const topRowY = height - 48;
  const bottomRowY = height - 70;

  if (wordmark) {
    const wmH = 20;
    const wmW = (wordmark.width / wordmark.height) * wmH;
    page.drawImage(wordmark, {
      x: brandX,
      y: topRowY - 4,
      width: wmW,
      height: wmH,
    });
  } else {
    page.drawText(brand.wordmark.toLowerCase(), {
      x: brandX,
      y: topRowY,
      size: 22,
      font: helveticaBold,
      color: WHITE,
    });
  }

  page.drawText('Employee payslip', {
    x: brandX,
    y: bottomRowY,
    size: 10,
    font: helvetica,
    color: WHITE,
  });

  drawRight(page, periodLabel, width - margin, topRowY + 2, 12, helveticaBold, WHITE);
  drawRight(page, data.clientName, width - margin, bottomRowY, 9, helvetica, rgb(1, 0.95, 0.93));

  y = height - headerH - 28;

  // ── Greeting ──────────────────────────────────────────────────────
  page.drawText(`Dear ${data.employeeName},`, {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: INK,
  });
  y -= 16;
  page.drawText(`Please find your payslip for ${periodLabel}.`, {
    x: margin,
    y,
    size: 11,
    font: helvetica,
    color: INK_MUTED,
  });
  y -= 22;

  // ── Employee info card ────────────────────────────────────────────
  const infoRows: [string, string][] = [
    ['Employee', data.employeeName + (data.employeeNumber ? ` (${data.employeeNumber})` : '')],
    ['Employer', data.clientName],
    ...(data.departmentName ? ([['Department', data.departmentName]] as [string, string][]) : []),
    ['Pay period', periodLabel],
  ];
  const boxPadding = 14;
  const infoBoxH = infoRows.length * 18 + boxPadding * 2;
  page.drawRectangle({
    x: margin,
    y: y - infoBoxH,
    width: contentWidth,
    height: infoBoxH,
    color: PAPER_2,
    borderColor: LINE,
    borderWidth: 1,
  });
  // Coral accent strip on left of info card
  page.drawRectangle({
    x: margin,
    y: y - infoBoxH,
    width: 3,
    height: infoBoxH,
    color: CORAL,
  });
  let infoY = y - boxPadding - 12;
  for (const [label, value] of infoRows) {
    page.drawText(label, {
      x: margin + boxPadding + 6,
      y: infoY,
      size: 9,
      font: helveticaBold,
      color: INK_SUBTLE,
    });
    drawRight(page, value, width - margin - boxPadding, infoY, 10, helvetica, INK);
    infoY -= 18;
  }
  y -= infoBoxH + 22;

  if (data.biweekly && data.biweeklyAttendance) {
    const a = data.biweeklyAttendance;
    const wd = (dates: string[]) =>
      dates
        .slice(0, 14)
        .map((iso) => {
          const [yy, mm, dd] = iso.split('-').map(Number);
          const dt = new Date(yy, mm - 1, dd);
          return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
        })
        .join(', ') + (dates.length > 14 ? '…' : '');
    page.drawText('Bi-weekly — days worked (Mon–Sat)', {
      x: margin,
      y,
      size: 10,
      font: helveticaBold,
      color: INK,
    });
    y -= 12;
    if (data.period1Gross)
      page.drawText(`Period 1 gross: ${fmt(data.period1Gross)} · ${a.period1.length} day(s)`, {
        x: margin,
        y,
        size: 9,
        font: helvetica,
        color: INK_MUTED,
      });
    y -= 11;
    const line1 = wd(a.period1) || '—';
    page.drawText(line1.length > 90 ? `${line1.slice(0, 87)}…` : line1, {
      x: margin,
      y,
      size: 8,
      font: helvetica,
      color: INK_SUBTLE,
    });
    y -= 12;
    if (data.period2Gross)
      page.drawText(`Period 2 gross: ${fmt(data.period2Gross)} · ${a.period2.length} day(s)`, {
        x: margin,
        y,
        size: 9,
        font: helvetica,
        color: INK_MUTED,
      });
    y -= 11;
    const line2 = wd(a.period2) || '—';
    page.drawText(line2.length > 90 ? `${line2.slice(0, 87)}…` : line2, {
      x: margin,
      y,
      size: 8,
      font: helvetica,
      color: INK_SUBTLE,
    });
    y -= 18;
  }

  const drawSectionTitle = (title: string) => {
    page.drawText(title.toUpperCase(), {
      x: margin,
      y,
      size: 9,
      font: helveticaBold,
      color: CORAL,
    });
    y -= 6;
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: CORAL,
    });
    y -= 16;
  };

  const drawRows = (rows: [string, string][], emphasizeLast = false) => {
    const rowH = 15;
    for (let i = 0; i < rows.length; i++) {
      const [label, amt] = rows[i];
      const isLast = emphasizeLast && i === rows.length - 1;
      if (isLast) {
        page.drawLine({
          start: { x: margin, y: y + 4 },
          end: { x: width - margin, y: y + 4 },
          thickness: 0.6,
          color: LINE,
        });
        y -= 4;
      }
      const font = isLast ? helveticaBold : helvetica;
      const color = isLast ? INK : INK_MUTED;
      const size = isLast ? 11 : 10;
      page.drawText(label, { x: margin, y, size, font, color });
      drawRight(page, amt, width - margin, y, size, font, color);
      y -= rowH;
    }
  };

  // ── Earnings ──────────────────────────────────────────────────────
  drawSectionTitle('Earnings');
  const leavePayNum = Number(data.leavePay ?? 0);
  const earningsRows: [string, string][] = [
    ['Basic pay', fmt(data.basicPay)],
    ...(data.allowances ?? []).map((a): [string, string] => [a.name, fmt(a.amount)]),
    ...(leavePayNum > 0 ? ([['Leave pay', fmt(data.leavePay!)]] as [string, string][]) : []),
    ['Gross pay', fmt(data.grossPay)],
  ];
  drawRows(earningsRows, true);
  y -= 14;

  // ── Deductions ────────────────────────────────────────────────────
  drawSectionTitle('Deductions');
  const deductionOnlyRows: [string, string][] = [
    ['PAYE', fmt(data.paye)],
    ['NSSF', fmt(data.nssf)],
    ['SHIF', fmt(data.nhif)],
    ['AHL (1.5%)', fmt(data.ahl ?? 0)],
    ...(data.deductions ?? []).map((d): [string, string] => [d.name, fmt(d.amount)]),
  ];
  drawRows(deductionOnlyRows, false);
  y -= 12;

  // ── Net pay highlight ─────────────────────────────────────────────
  const netBoxH = 52;
  page.drawRectangle({
    x: margin,
    y: y - netBoxH,
    width: contentWidth,
    height: netBoxH,
    color: CORAL,
  });
  page.drawText('NET PAY', {
    x: margin + 16,
    y: y - 22,
    size: 9,
    font: helveticaBold,
    color: WHITE,
  });
  page.drawText(fmt(data.netPay), {
    x: margin + 16,
    y: y - 42,
    size: 18,
    font: helveticaBold,
    color: WHITE,
  });
  drawRight(page, periodLabel, width - margin - 16, y - 32, 10, helvetica, rgb(1, 0.92, 0.88));
  y -= netBoxH + 18;

  const nitaNum = Number(data.employerNita ?? 0);
  if (nitaNum > 0) {
    page.drawText('Employer contributions (informational)', {
      x: margin,
      y,
      size: 9,
      font: helveticaBold,
      color: INK_SUBTLE,
    });
    y -= 14;
    page.drawText('NITA levy (employer — not deducted from your pay)', {
      x: margin,
      y,
      size: 9,
      font: helvetica,
      color: INK_MUTED,
    });
    drawRight(page, fmt(data.employerNita!), width - margin, y, 9, helvetica, INK_MUTED);
    y -= 16;
  }

  // ── Footer ────────────────────────────────────────────────────────
  const footerY = 42;
  page.drawLine({
    start: { x: margin, y: footerY + 18 },
    end: { x: width - margin, y: footerY + 18 },
    thickness: 0.75,
    color: LINE,
  });
  const footerLeft = `${brand.wordmark} · Confidential employee document`;
  page.drawText(footerLeft, {
    x: margin,
    y: footerY,
    size: 8,
    font: helvetica,
    color: INK_SUBTLE,
  });
  const footerRight = [brand.orgName, brand.contactAddress].filter(Boolean).join(' · ') || data.clientName;
  drawRight(page, footerRight, width - margin, footerY, 8, helvetica, INK_SUBTLE);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Merge several single-payslip PDF buffers into one multi-page document
 * (one payslip per A4 page) for a "print all / download all" batch.
 */
export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((page) => out.addPage(page));
  }
  return Buffer.from(await out.save());
}
