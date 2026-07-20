import ExcelJS from 'exceljs';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

/** Normalized leave-report dataset shared by internal staff + outsourced exports. */
export type LeaveReportAudience = 'staff' | 'outsourced';

export type LeaveReportBalance = {
  leaveTypeName: string;
  color: string | null;
  /** Entitled including carry-over. */
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
};

export type LeaveReportApplication = {
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
};

export type LeaveReportLiabilityRow = {
  leaveTypeName: string;
  remainingDays: number;
  /** null when the audience has no salary basis (internal staff). */
  dailyRate: number | null;
  amount: number | null;
};

export type LeaveReportPerson = {
  id: string;
  name: string;
  /** Employee number (outsourced) or email (staff). */
  identifier: string | null;
  /** Department name (outsourced) or role label (staff). */
  group: string;
  costCenter: string | null;
  annual: { entitled: number; used: number; pending: number; remaining: number };
  ytdTaken: number;
  balances: LeaveReportBalance[];
  applications: LeaveReportApplication[];
  liability: LeaveReportLiabilityRow[];
  liabilityTotal: number | null;
  approvers: string[];
};

export type LeaveReportDataset = {
  audience: LeaveReportAudience;
  /** Human title — "Internal staff" or the end-client name. */
  title: string;
  orgName: string;
  year: number;
  currency: string;
  /** Whether liability amounts are monetary (outsourced) or leave-days only (staff). */
  hasMonetaryLiability: boolean;
  /** Column header for the grouping dimension ("Role" or "Department"). */
  groupLabel: string;
  people: LeaveReportPerson[];
};

export type LeaveReportType = 'roster' | 'person' | 'liability';
export type LeaveReportGroupBy = 'none' | 'group' | 'costCenter' | 'type';

export type LeaveReportOptions = {
  report: LeaveReportType;
  groupBy: LeaveReportGroupBy;
  /** When set, restrict a person report to a single individual. */
  personId?: string | null;
};

// ————————————————————————————————————————————————————————————————
// Shared helpers
// ————————————————————————————————————————————————————————————————

function fmtNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function fmtMoney(value: number | null, currency: string): string {
  if (value == null) return '—';
  return `${currency} ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function groupKeyFor(person: LeaveReportPerson, groupBy: LeaveReportGroupBy): string {
  if (groupBy === 'costCenter') return person.costCenter?.trim() || 'No cost centre';
  if (groupBy === 'group') return person.group?.trim() || 'Unassigned';
  return 'All';
}

/** Order + partition people into labelled groups (single "All" group when ungrouped). */
export function partitionPeople(
  people: LeaveReportPerson[],
  groupBy: LeaveReportGroupBy,
): Array<{ key: string; people: LeaveReportPerson[] }> {
  if (groupBy !== 'group' && groupBy !== 'costCenter') {
    return [{ key: 'All', people }];
  }
  const map = new Map<string, LeaveReportPerson[]>();
  for (const p of people) {
    const key = groupKeyFor(p, groupBy);
    const bucket = map.get(key);
    if (bucket) bucket.push(p);
    else map.set(key, [p]);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({ key, people: list }));
}

export function reportFileBase(dataset: LeaveReportDataset, options: LeaveReportOptions): string {
  const slug = dataset.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'leave';
  return `leave-${options.report}-${slug}-${dataset.year}`;
}

// ————————————————————————————————————————————————————————————————
// PDF generator (pdf-lib)
// ————————————————————————————————————————————————————————————————

const BRAND = rgb(0.016, 0.239, 0.29); // #043d4a
const INK = rgb(0.09, 0.11, 0.13);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.89);
const ZEBRA = rgb(0.965, 0.973, 0.976);

type PdfCtx = {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
  width: number;
  height: number;
  margin: number;
};

const A4: [number, number] = [595.28, 841.89];

function newPage(ctx: PdfCtx): void {
  ctx.page = ctx.doc.addPage(A4);
  ctx.y = ctx.height - ctx.margin;
}

function ensureSpace(ctx: PdfCtx, needed: number): void {
  if (ctx.y - needed < ctx.margin) newPage(ctx);
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function drawHeaderBand(ctx: PdfCtx, dataset: LeaveReportDataset, subtitle: string): void {
  const { page, width, margin } = ctx;
  page.drawRectangle({ x: 0, y: ctx.height - 96, width, height: 96, color: BRAND });
  page.drawText(dataset.orgName, { x: margin, y: ctx.height - 40, size: 16, font: ctx.bold, color: rgb(1, 1, 1) });
  page.drawText(subtitle, { x: margin, y: ctx.height - 60, size: 10, font: ctx.font, color: rgb(0.85, 0.9, 0.92) });
  page.drawText(`Leave year ${dataset.year}`, {
    x: margin,
    y: ctx.height - 76,
    size: 9,
    font: ctx.font,
    color: rgb(0.75, 0.83, 0.86),
  });
  const stamp = `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  page.drawText(stamp, {
    x: width - margin - ctx.font.widthOfTextAtSize(stamp, 8),
    y: ctx.height - 76,
    size: 8,
    font: ctx.font,
    color: rgb(0.75, 0.83, 0.86),
  });
  ctx.y = ctx.height - 96 - 24;
}

type Col = { label: string; width: number; align?: 'left' | 'right' };

function drawTable(
  ctx: PdfCtx,
  cols: Col[],
  rows: Array<Array<string>>,
  opts?: { headColor?: ReturnType<typeof rgb>; fontSize?: number },
): void {
  const size = opts?.fontSize ?? 8.5;
  const rowH = size + 8;
  const startX = ctx.margin;

  const drawHead = () => {
    ensureSpace(ctx, rowH * 2);
    ctx.page.drawRectangle({
      x: startX,
      y: ctx.y - rowH,
      width: cols.reduce((s, c) => s + c.width, 0),
      height: rowH,
      color: opts?.headColor ?? BRAND,
    });
    let x = startX;
    for (const col of cols) {
      const label = truncate(col.label, ctx.bold, size, col.width - 8);
      const tx = col.align === 'right' ? x + col.width - 4 - ctx.bold.widthOfTextAtSize(label, size) : x + 4;
      ctx.page.drawText(label, { x: tx, y: ctx.y - rowH + 6, size, font: ctx.bold, color: rgb(1, 1, 1) });
      x += col.width;
    }
    ctx.y -= rowH;
  };

  drawHead();
  let zebra = false;
  for (const row of rows) {
    ensureSpace(ctx, rowH);
    if (ctx.y === ctx.height - ctx.margin) drawHead();
    const totalW = cols.reduce((s, c) => s + c.width, 0);
    if (zebra) {
      ctx.page.drawRectangle({ x: startX, y: ctx.y - rowH, width: totalW, height: rowH, color: ZEBRA });
    }
    zebra = !zebra;
    let x = startX;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const raw = row[i] ?? '';
      const label = truncate(raw, ctx.font, size, col.width - 8);
      const tx = col.align === 'right' ? x + col.width - 4 - ctx.font.widthOfTextAtSize(label, size) : x + 4;
      ctx.page.drawText(label, { x: tx, y: ctx.y - rowH + 6, size, font: ctx.font, color: INK });
      x += col.width;
    }
    ctx.page.drawLine({
      start: { x: startX, y: ctx.y - rowH },
      end: { x: startX + totalW, y: ctx.y - rowH },
      thickness: 0.4,
      color: LINE,
    });
    ctx.y -= rowH;
  }
  ctx.y -= 10;
}

function drawSectionTitle(ctx: PdfCtx, text: string): void {
  ensureSpace(ctx, 26);
  ctx.page.drawText(text, { x: ctx.margin, y: ctx.y - 12, size: 11, font: ctx.bold, color: BRAND });
  ctx.y -= 22;
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function drawRosterReport(ctx: PdfCtx, dataset: LeaveReportDataset, options: LeaveReportOptions): void {
  const groups = partitionPeople(dataset.people, options.groupBy);
  const contentW = ctx.width - ctx.margin * 2;
  const cols: Col[] = [
    { label: 'Name', width: contentW * 0.26 },
    { label: dataset.groupLabel, width: contentW * 0.2 },
    { label: 'Annual', width: contentW * 0.1, align: 'right' },
    { label: 'Used', width: contentW * 0.1, align: 'right' },
    { label: 'Pending', width: contentW * 0.11, align: 'right' },
    { label: 'Remaining', width: contentW * 0.13, align: 'right' },
    { label: 'YTD', width: contentW * 0.1, align: 'right' },
  ];

  for (const group of groups) {
    if (options.groupBy === 'group' || options.groupBy === 'costCenter') {
      drawSectionTitle(ctx, `${group.key}  ·  ${group.people.length} people`);
    }
    const rows = group.people.map((p) => [
      p.identifier ? `${p.name}  (${p.identifier})` : p.name,
      p.group,
      fmtNumber(p.annual.entitled),
      fmtNumber(p.annual.used),
      fmtNumber(p.annual.pending),
      fmtNumber(p.annual.remaining),
      fmtNumber(p.ytdTaken),
    ]);
    const totals = group.people.reduce(
      (acc, p) => {
        acc.entitled += p.annual.entitled;
        acc.used += p.annual.used;
        acc.pending += p.annual.pending;
        acc.remaining += p.annual.remaining;
        acc.ytd += p.ytdTaken;
        return acc;
      },
      { entitled: 0, used: 0, pending: 0, remaining: 0, ytd: 0 },
    );
    rows.push([
      'Subtotal',
      '',
      fmtNumber(totals.entitled),
      fmtNumber(totals.used),
      fmtNumber(totals.pending),
      fmtNumber(totals.remaining),
      fmtNumber(totals.ytd),
    ]);
    drawTable(ctx, cols, rows);
  }
}

function drawLiabilityReport(ctx: PdfCtx, dataset: LeaveReportDataset, options: LeaveReportOptions): void {
  const groups = partitionPeople(dataset.people, options.groupBy);
  const contentW = ctx.width - ctx.margin * 2;
  const monetary = dataset.hasMonetaryLiability;
  const cols: Col[] = monetary
    ? [
        { label: 'Name', width: contentW * 0.3 },
        { label: 'Leave type', width: contentW * 0.24 },
        { label: 'Days left', width: contentW * 0.13, align: 'right' },
        { label: 'Daily rate', width: contentW * 0.16, align: 'right' },
        { label: 'Liability', width: contentW * 0.17, align: 'right' },
      ]
    : [
        { label: 'Name', width: contentW * 0.4 },
        { label: 'Leave type', width: contentW * 0.35 },
        { label: 'Days remaining', width: contentW * 0.25, align: 'right' },
      ];

  let grandTotal = 0;
  let grandDays = 0;
  for (const group of groups) {
    if (options.groupBy === 'group' || options.groupBy === 'costCenter') {
      drawSectionTitle(ctx, group.key);
    }
    const rows: string[][] = [];
    let groupTotal = 0;
    let groupDays = 0;
    for (const p of group.people) {
      for (const row of p.liability) {
        groupDays += row.remainingDays;
        grandDays += row.remainingDays;
        if (monetary) {
          groupTotal += row.amount ?? 0;
          grandTotal += row.amount ?? 0;
          rows.push([
            p.name,
            row.leaveTypeName,
            fmtNumber(row.remainingDays),
            fmtMoney(row.dailyRate, dataset.currency),
            fmtMoney(row.amount, dataset.currency),
          ]);
        } else {
          rows.push([p.name, row.leaveTypeName, fmtNumber(row.remainingDays)]);
        }
      }
    }
    if (rows.length === 0) continue;
    rows.push(
      monetary
        ? ['Subtotal', '', fmtNumber(groupDays), '', fmtMoney(groupTotal, dataset.currency)]
        : ['Subtotal', '', fmtNumber(groupDays)],
    );
    drawTable(ctx, cols, rows);
  }

  ensureSpace(ctx, 24);
  const summary = monetary
    ? `Total estimated leave liability: ${fmtMoney(grandTotal, dataset.currency)}  (${fmtNumber(grandDays)} days)`
    : `Total outstanding leave: ${fmtNumber(grandDays)} days`;
  ctx.page.drawText(summary, { x: ctx.margin, y: ctx.y - 4, size: 10, font: ctx.bold, color: BRAND });
  ctx.y -= 20;
}

function drawPersonReport(ctx: PdfCtx, dataset: LeaveReportDataset, people: LeaveReportPerson[]): void {
  const contentW = ctx.width - ctx.margin * 2;
  people.forEach((p, idx) => {
    if (idx > 0) newPage(ctx);
    ensureSpace(ctx, 70);
    // Person header card
    ctx.page.drawRectangle({ x: ctx.margin, y: ctx.y - 54, width: contentW, height: 54, color: ZEBRA });
    ctx.page.drawText(p.name, { x: ctx.margin + 12, y: ctx.y - 22, size: 13, font: ctx.bold, color: INK });
    const sub = [p.identifier, p.group, p.costCenter].filter(Boolean).join('  ·  ');
    if (sub) {
      ctx.page.drawText(sub, { x: ctx.margin + 12, y: ctx.y - 38, size: 9, font: ctx.font, color: MUTED });
    }
    const annual = `Annual: ${fmtNumber(p.annual.remaining)} left · ${fmtNumber(p.annual.used)} used · ${fmtNumber(p.annual.pending)} pending`;
    ctx.page.drawText(annual, {
      x: ctx.margin + contentW - 12 - ctx.font.widthOfTextAtSize(annual, 9),
      y: ctx.y - 22,
      size: 9,
      font: ctx.font,
      color: BRAND,
    });
    ctx.y -= 66;

    drawSectionTitle(ctx, 'Balances');
    drawTable(
      ctx,
      [
        { label: 'Leave type', width: contentW * 0.4 },
        { label: 'Entitled', width: contentW * 0.15, align: 'right' },
        { label: 'Used', width: contentW * 0.15, align: 'right' },
        { label: 'Pending', width: contentW * 0.15, align: 'right' },
        { label: 'Available', width: contentW * 0.15, align: 'right' },
      ],
      p.balances.map((b) => [
        b.leaveTypeName,
        fmtNumber(b.entitled),
        fmtNumber(b.used),
        fmtNumber(b.pending),
        fmtNumber(b.remaining),
      ]),
    );

    drawSectionTitle(ctx, `${dataset.year} leave history`);
    if (p.applications.length === 0) {
      ctx.page.drawText('No dated leave this year.', { x: ctx.margin, y: ctx.y - 4, size: 9, font: ctx.font, color: MUTED });
      ctx.y -= 18;
    } else {
      drawTable(
        ctx,
        [
          { label: 'Leave type', width: contentW * 0.34 },
          { label: 'Start', width: contentW * 0.2 },
          { label: 'End', width: contentW * 0.2 },
          { label: 'Days', width: contentW * 0.11, align: 'right' },
          { label: 'Status', width: contentW * 0.15 },
        ],
        p.applications.map((a) => [
          a.leaveTypeName,
          a.startDate,
          a.endDate,
          fmtNumber(a.days),
          statusLabel(a.status),
        ]),
      );
    }

    if (p.approvers.length > 0) {
      ensureSpace(ctx, 20);
      ctx.page.drawText(`Approvers: ${p.approvers.join(', ')}`, {
        x: ctx.margin,
        y: ctx.y - 4,
        size: 8.5,
        font: ctx.font,
        color: MUTED,
      });
      ctx.y -= 16;
    }
  });
}

export async function buildLeaveReportPdf(
  dataset: LeaveReportDataset,
  options: LeaveReportOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: PdfCtx = {
    doc,
    font,
    bold,
    page: doc.addPage(A4),
    y: 0,
    width: A4[0],
    height: A4[1],
    margin: 40,
  };

  const reportName =
    options.report === 'liability'
      ? 'Leave liability report'
      : options.report === 'person'
        ? 'Individual leave statements'
        : 'Leave roster';
  drawHeaderBand(ctx, dataset, `${dataset.title} — ${reportName}`);

  if (options.report === 'roster') {
    drawRosterReport(ctx, dataset, options);
  } else if (options.report === 'liability') {
    drawLiabilityReport(ctx, dataset, options);
  } else {
    const people = options.personId
      ? dataset.people.filter((p) => p.id === options.personId)
      : dataset.people;
    drawPersonReport(ctx, dataset, people);
  }

  return doc.save();
}

// ————————————————————————————————————————————————————————————————
// Excel generator (ExcelJS)
// ————————————————————————————————————————————————————————————————

const XLSX_BRAND = 'FF043D4A';

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XLSX_BRAND } };
  row.alignment = { wrapText: true, vertical: 'middle' };
  row.height = 20;
}

function sortedPeople(people: LeaveReportPerson[], groupBy: LeaveReportGroupBy): LeaveReportPerson[] {
  if (groupBy === 'costCenter') {
    return [...people].sort((a, b) => (a.costCenter ?? '').localeCompare(b.costCenter ?? '') || a.name.localeCompare(b.name));
  }
  if (groupBy === 'group') {
    return [...people].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  }
  return [...people].sort((a, b) => a.name.localeCompare(b.name));
}

export async function buildLeaveReportWorkbook(
  dataset: LeaveReportDataset,
  options: LeaveReportOptions,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Stride';
  wb.created = new Date();

  const people = sortedPeople(dataset.people, options.groupBy);
  const monetary = dataset.hasMonetaryLiability;

  // Summary sheet
  const summary = wb.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: XLSX_BRAND } },
  });
  const summaryHeaders = ['Name', 'Identifier', dataset.groupLabel, 'Cost centre', 'Annual entitled', 'Used', 'Pending', 'Remaining', 'YTD taken', 'Approvers'];
  summary.addRow(summaryHeaders);
  styleHeader(summary.getRow(1));
  for (const p of people) {
    summary.addRow([
      p.name,
      p.identifier ?? '',
      p.group,
      p.costCenter ?? '',
      p.annual.entitled,
      p.annual.used,
      p.annual.pending,
      p.annual.remaining,
      p.ytdTaken,
      p.approvers.join(', '),
    ]);
  }
  summary.columns = [{ width: 26 }, { width: 16 }, { width: 22 }, { width: 18 }, { width: 14 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 30 }];

  // Balances sheet
  const balances = wb.addWorksheet('Balances', { views: [{ state: 'frozen', ySplit: 1 }] });
  balances.addRow(['Name', dataset.groupLabel, 'Leave type', 'Entitled', 'Used', 'Pending', 'Available']);
  styleHeader(balances.getRow(1));
  for (const p of people) {
    for (const b of p.balances) {
      balances.addRow([p.name, p.group, b.leaveTypeName, b.entitled, b.used, b.pending, b.remaining]);
    }
  }
  balances.columns = [{ width: 26 }, { width: 22 }, { width: 20 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 12 }];

  // Applications sheet
  const apps = wb.addWorksheet('Applications', { views: [{ state: 'frozen', ySplit: 1 }] });
  apps.addRow(['Name', dataset.groupLabel, 'Leave type', 'Start', 'End', 'Days', 'Status']);
  styleHeader(apps.getRow(1));
  for (const p of people) {
    for (const a of p.applications) {
      apps.addRow([p.name, p.group, a.leaveTypeName, a.startDate, a.endDate, a.days, statusLabel(a.status)]);
    }
  }
  apps.columns = [{ width: 26 }, { width: 22 }, { width: 20 }, { width: 12 }, { width: 12 }, { width: 8 }, { width: 12 }];

  // Liability sheet
  const liability = wb.addWorksheet('Liability', { views: [{ state: 'frozen', ySplit: 1 }] });
  const liabilityHeaders = monetary
    ? ['Name', dataset.groupLabel, 'Cost centre', 'Leave type', 'Days left', 'Daily rate', `Liability (${dataset.currency})`]
    : ['Name', dataset.groupLabel, 'Leave type', 'Days remaining'];
  liability.addRow(liabilityHeaders);
  styleHeader(liability.getRow(1));
  for (const p of people) {
    for (const row of p.liability) {
      if (monetary) {
        liability.addRow([p.name, p.group, p.costCenter ?? '', row.leaveTypeName, row.remainingDays, row.dailyRate ?? 0, row.amount ?? 0]);
      } else {
        liability.addRow([p.name, p.group, row.leaveTypeName, row.remainingDays]);
      }
    }
  }
  liability.columns = monetary
    ? [{ width: 26 }, { width: 22 }, { width: 18 }, { width: 20 }, { width: 10 }, { width: 14 }, { width: 18 }]
    : [{ width: 26 }, { width: 22 }, { width: 20 }, { width: 14 }];
  if (monetary) {
    for (let i = 2; i <= liability.rowCount; i++) {
      liability.getRow(i).getCell(6).numFmt = '#,##0.00';
      liability.getRow(i).getCell(7).numFmt = '#,##0.00';
    }
  }

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };
  for (const sheet of [summary, balances, apps, liability]) {
    for (let i = 1; i <= sheet.rowCount; i++) {
      sheet.getRow(i).eachCell((cell) => {
        cell.border = borderStyle;
        if (i > 1) cell.alignment = { vertical: 'top', wrapText: true };
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
