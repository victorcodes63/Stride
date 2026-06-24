/**
 * Generate payslip PDF for email attachment.
 * World-class layout matching professional reference design.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { existsSync, readFileSync } from 'fs';
import { brand, getLogoFileAbsolutePath } from '@/lib/brand';

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

// Brand colors
const PRIMARY = rgb(26 / 255, 23 / 255, 20 / 255);       // #1A1714 Stride ink
const SECONDARY = rgb(255 / 255, 84 / 255, 54 / 255);  // #FF5436 Stride coral
const GRAY_600 = rgb(82 / 255, 82 / 255, 82 / 255);
const GRAY_500 = rgb(115 / 255, 115 / 255, 115 / 255);
const LIGHT_BG = rgb(249 / 255, 250 / 255, 251 / 255); // #f9fafb
const BORDER = rgb(229 / 255, 229 / 255, 229 / 255);

/** PNG for pdf-lib (embedPng). Uses NEXT_PUBLIC_BRAND_LOGO_PNG via getLogoFileAbsolutePath(). */
const LOGO_PATH = getLogoFileAbsolutePath();
const BRAND_LINE = brand.wordmark;

export async function generatePayslipPdf(
  data: PayslipPdfData,
  month: number,
  year: number
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const monthName = MONTH_NAMES[month - 1] ?? String(month);
  const fmt = (v: string | number) => `KES ${formatAmount(v)}`;

  const margin = 60;
  const contentWidth = width - margin * 2;
  let y = height - margin;

  // 1. Logo (centered)
  if (existsSync(LOGO_PATH)) {
    try {
      const logoBytes = readFileSync(LOGO_PATH);
      const png = await doc.embedPng(logoBytes);
      const logoW = 120;
      const logoH = (png.height / png.width) * logoW;
      page.drawImage(png, {
        x: width / 2 - logoW / 2,
        y: y - logoH,
        width: logoW,
        height: logoH,
      });
      y -= logoH + 8;
    } catch {
      // Fallback to text branding
      const w = helveticaBold.widthOfTextAtSize(BRAND_LINE, 16);
      page.drawText(BRAND_LINE, {
        x: width / 2 - w / 2,
        y: y - 16,
        size: 16,
        font: helveticaBold,
        color: PRIMARY,
      });
      y -= 28;
    }
  } else {
    const w = helveticaBold.widthOfTextAtSize(BRAND_LINE, 16);
    page.drawText(BRAND_LINE, {
      x: width / 2 - w / 2,
      y: y - 16,
      size: 16,
      font: helveticaBold,
      color: PRIMARY,
    });
    y -= 28;
  }

  // Horizontal line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.75,
    color: BORDER,
  });
  y -= 28;

  // 2. Greeting
  page.drawText(`Dear ${data.employeeName},`, {
    x: margin,
    y,
    size: 14,
    font: helvetica,
    color: GRAY_600,
  });
  y -= 16;
  page.drawText(`Please find your payslip for ${monthName} ${year}.`, {
    x: margin,
    y,
    size: 12,
    font: helvetica,
    color: GRAY_600,
  });
  y -= 24;

  // 3. Employee/Client/Department box (light grey background)
  const boxPadding = 16;
  const infoRows = [
    ['Employee', data.employeeName + (data.employeeNumber ? ` (${data.employeeNumber})` : '')],
    ['Client', data.clientName],
    ...(data.departmentName ? [['Department', data.departmentName]] as [string, string][] : []),
  ];
  const infoBoxH = infoRows.length * 20 + boxPadding * 2;
  page.drawRectangle({
    x: margin,
    y: y - infoBoxH,
    width: contentWidth,
    height: infoBoxH,
    color: LIGHT_BG,
    borderColor: BORDER,
    borderWidth: 1,
  });
  let infoY = y - boxPadding - 14;
  for (const [label, value] of infoRows) {
    page.drawText(label, { x: margin + boxPadding, y: infoY, size: 11, font: helveticaBold, color: GRAY_600 });
    const valW = helvetica.widthOfTextAtSize(value, 11);
    page.drawText(value, { x: width - margin - boxPadding - valW, y: infoY, size: 11, font: helvetica, color: GRAY_600 });
    infoY -= 20;
  }
  y -= infoBoxH + 24;

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
      color: PRIMARY,
    });
    y -= 12;
    if (data.period1Gross)
      page.drawText(`Period 1 gross: ${fmt(data.period1Gross)} · ${a.period1.length} day(s)`, {
        x: margin,
        y,
        size: 9,
        font: helvetica,
        color: GRAY_600,
      });
    y -= 11;
    const line1 = wd(a.period1) || '—';
    page.drawText(line1.length > 90 ? line1.slice(0, 87) + '…' : line1, {
      x: margin,
      y,
      size: 8,
      font: helvetica,
      color: GRAY_500,
    });
    y -= 12;
    if (data.period2Gross)
      page.drawText(`Period 2 gross: ${fmt(data.period2Gross)} · ${a.period2.length} day(s)`, {
        x: margin,
        y,
        size: 9,
        font: helvetica,
        color: GRAY_600,
      });
    y -= 11;
    const line2 = wd(a.period2) || '—';
    page.drawText(line2.length > 90 ? line2.slice(0, 87) + '…' : line2, {
      x: margin,
      y,
      size: 8,
      font: helvetica,
      color: GRAY_500,
    });
    y -= 18;
  }

  // 4. Earnings section
  page.drawText('Earnings', {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: PRIMARY,
  });
  y -= 20;

  const leavePayNum = Number(data.leavePay ?? 0);
  const earningsRows: [string, string][] = [
    ['Basic pay', fmt(data.basicPay)],
    ...(data.allowances ?? []).map((a): [string, string] => [a.name, fmt(a.amount)]),
    ...(leavePayNum > 0 ? ([['Leave pay', fmt(data.leavePay!)]] as [string, string][]) : []),
    ['Gross pay', fmt(data.grossPay)],
  ];
  const rowH = 14;
  for (let i = 0; i < earningsRows.length; i++) {
    const [label, amt] = earningsRows[i];
    const isTotal = label === 'Gross pay';
    if (isTotal) {
      page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 0.5,
        color: BORDER,
      });
      y -= 6;
    }
    const font = isTotal ? helveticaBold : helvetica;
    const color = isTotal ? PRIMARY : GRAY_600;
    page.drawText(label, { x: margin, y, size: 11, font, color });
    const amtW = font.widthOfTextAtSize(amt, 11);
    page.drawText(amt, { x: width - margin - amtW, y, size: 11, font, color });
    y -= rowH;
  }
  y -= 16;

  // 5. Deductions section
  page.drawText('Deductions', {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: PRIMARY,
  });
  y -= 20;

  const deductionsRows: [string, string][] = [
    ['PAYE', fmt(data.paye)],
    ['NSSF', fmt(data.nssf)],
    ['SHIF', fmt(data.nhif)],
    ['AHL (1.5%)', fmt(data.ahl ?? 0)],
    ...(data.deductions ?? []).map((d): [string, string] => [d.name, fmt(d.amount)]),
    ['Net pay', fmt(data.netPay)],
  ];
  for (let i = 0; i < deductionsRows.length; i++) {
    const [label, amt] = deductionsRows[i];
    const isTotal = label === 'Net pay';
    if (isTotal) {
      page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 0.5,
        color: BORDER,
      });
      y -= 6;
    }
    const font = isTotal ? helveticaBold : helvetica;
    const color = isTotal ? SECONDARY : GRAY_600;
    page.drawText(label, { x: margin, y, size: 11, font, color });
    const amtW = font.widthOfTextAtSize(amt, 11);
    page.drawText(amt, { x: width - margin - amtW, y, size: 11, font, color });
    y -= rowH;
  }
  y -= 8;

  const nitaNum = Number(data.employerNita ?? 0);
  if (nitaNum > 0) {
    page.drawText('Employer contributions (informational)', {
      x: margin,
      y,
      size: 11,
      font: helveticaBold,
      color: GRAY_500,
    });
    y -= 16;
    page.drawText('NITA levy (employer — not deducted from your pay)', {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: GRAY_600,
    });
    const nitaAmt = fmt(data.employerNita!);
    const nitaW = helvetica.widthOfTextAtSize(nitaAmt, 10);
    page.drawText(nitaAmt, { x: width - margin - nitaW, y, size: 10, font: helvetica, color: GRAY_600 });
    y -= rowH + 8;
  }

  // 6. Footer (centered)
  const footer = [brand.orgName, brand.contactAddress].filter(Boolean).join(', ');
  const footerW = helvetica.widthOfTextAtSize(footer, 9);
  page.drawText(footer, {
    x: width / 2 - footerW / 2,
    y: 50,
    size: 9,
    font: helvetica,
    color: GRAY_500,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
