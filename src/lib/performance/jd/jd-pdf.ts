/**
 * Job description PDF — formal multi-section HR document (A4, pdf-lib).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { brand, getLogoFileAbsolutePath } from '@/lib/brand';
import { STRIDE_MARK_PNG_SRC } from '@/lib/brand-constants';
import { STRIDE_PALETTE } from '@/lib/stride-palette';
import type { JobDescriptionDetailDto } from '@/lib/performance/jd/types';

export type JdPdfBranding = {
  orgName: string;
  documentFooter?: string | null;
  contactAddress?: string | null;
};

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 48;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 56;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

function hexRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return rgb(
    Number.parseInt(h.slice(0, 2), 16) / 255,
    Number.parseInt(h.slice(2, 4), 16) / 255,
    Number.parseInt(h.slice(4, 6), 16) / 255,
  );
}

const INK = hexRgb(STRIDE_PALETTE.ink);
const INK_MUTED = hexRgb(STRIDE_PALETTE.inkMuted);
const INK_SUBTLE = hexRgb(STRIDE_PALETTE.inkSubtle);
const LINE = hexRgb(STRIDE_PALETTE.line);
const PAPER_2 = hexRgb(STRIDE_PALETTE.paper2);
const CORAL = hexRgb(STRIDE_PALETTE.coral);
const WHITE = rgb(1, 1, 1);

const PERSPECTIVE_LABEL: Record<string, string> = {
  financial: 'Financial',
  customer: 'Customer',
  internal_process: 'Internal process',
  learning_growth: 'Learning & growth',
};

/**
 * pdf-lib's standard Helvetica only supports WinAnsi (Latin-1 + a few extras),
 * and it throws on any other code point (e.g. "≥", "→"). JD content routinely
 * contains such symbols in KPI targets, so we map the common ones to ASCII and
 * drop anything else that WinAnsi can't represent — otherwise the whole export
 * 500s with "WinAnsi cannot encode …".
 */
const PDF_SYMBOL_MAP: Record<string, string> = {
  '≥': '>=',
  '≤': '<=',
  '≠': '!=',
  '≈': '~',
  '≡': '=',
  '−': '-',
  '‒': '-',
  '‑': '-',
  '⁄': '/',
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '⇒': '=>',
  '⇐': '<=',
  '↑': '^',
  '↓': 'v',
  '∞': 'infinity',
  '√': 'sqrt',
  '∑': 'sum',
  '∅': 'null',
  '№': 'No.',
  '℅': 'c/o',
};

// Code points above 0xFF that WinAnsi *can* encode (must be preserved as-is).
const WINANSI_EXTRA = new Set(
  [
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
    0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
    0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
  ],
);

// WinAnsi has no glyph at these positions in the 0x80–0x9F range.
const WINANSI_UNDEFINED = new Set([0x81, 0x8d, 0x8f, 0x90, 0x9d]);

function pdfSafe(text: string | null | undefined): string {
  if (!text) return '';
  let out = '';
  for (const ch of text) {
    const mapped = PDF_SYMBOL_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x09) {
      out += ' ';
    } else if (cp >= 0x20 && cp <= 0xff && !WINANSI_UNDEFINED.has(cp)) {
      out += ch;
    } else if (WINANSI_EXTRA.has(cp)) {
      out += ch;
    }
    // else: drop characters WinAnsi cannot represent (emoji, exotic symbols).
  }
  return out;
}

function wrapText(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const raw = pdfSafe(text).trim();
  if (!raw) return [];
  const paragraphs = raw.split(/\n+/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
        line = trial;
      } else {
        if (line) lines.push(line);
        if (font.widthOfTextAtSize(word, size) <= maxWidth) {
          line = word;
        } else {
          let rest = word;
          while (rest) {
            let i = 1;
            while (i < rest.length && font.widthOfTextAtSize(rest.slice(0, i), size) <= maxWidth) i += 1;
            const cut = Math.max(1, i - 1);
            lines.push(rest.slice(0, cut));
            rest = rest.slice(cut);
          }
          line = '';
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

async function embedMark(doc: PDFDocument) {
  for (const candidate of [brand.logoPngPath, STRIDE_MARK_PNG_SRC, '/brand/stride-mark-192.png']) {
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

type DrawCtx = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  branding: JdPdfBranding;
  pageIndex: number;
};

function ensureSpace(ctx: DrawCtx, needed: number) {
  if (ctx.y - needed >= MARGIN_BOTTOM) return;
  drawFooter(ctx);
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pageIndex += 1;
  ctx.y = PAGE_H - MARGIN_TOP;
  drawContinuationHeader(ctx);
}

function drawFooter(ctx: DrawCtx) {
  const footer = pdfSafe(
    ctx.branding.documentFooter?.trim() ||
      `${ctx.branding.orgName} — Job description`,
  );
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: MARGIN_BOTTOM - 16 },
    end: { x: PAGE_W - MARGIN_X, y: MARGIN_BOTTOM - 16 },
    thickness: 0.5,
    color: LINE,
  });
  ctx.page.drawText(footer.slice(0, 90), {
    x: MARGIN_X,
    y: MARGIN_BOTTOM - 30,
    size: 8,
    font: ctx.font,
    color: INK_SUBTLE,
  });
  const pageLabel = `Page ${ctx.pageIndex}`;
  const w = ctx.font.widthOfTextAtSize(pageLabel, 8);
  ctx.page.drawText(pageLabel, {
    x: PAGE_W - MARGIN_X - w,
    y: MARGIN_BOTTOM - 30,
    size: 8,
    font: ctx.font,
    color: INK_SUBTLE,
  });
}

function drawContinuationHeader(ctx: DrawCtx) {
  ctx.page.drawText('Job description (continued)', {
    x: MARGIN_X,
    y: ctx.y,
    size: 9,
    font: ctx.font,
    color: INK_SUBTLE,
  });
  ctx.y -= 18;
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: PAGE_W - MARGIN_X, y: ctx.y },
    thickness: 0.5,
    color: LINE,
  });
  ctx.y -= 16;
}

function drawSectionTitle(ctx: DrawCtx, title: string) {
  ensureSpace(ctx, 36);
  ctx.y -= 8;
  ctx.page.drawText(title.toUpperCase(), {
    x: MARGIN_X,
    y: ctx.y,
    size: 10,
    font: ctx.bold,
    color: INK,
  });
  ctx.y -= 6;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y,
    width: 36,
    height: 2,
    color: CORAL,
  });
  ctx.y -= 16;
}

function drawBody(ctx: DrawCtx, text: string | null | undefined, size = 10) {
  const lines = wrapText(ctx.font, text ?? '—', size, CONTENT_W);
  const lineH = size + 4;
  for (const line of lines) {
    ensureSpace(ctx, lineH + 4);
    ctx.page.drawText(line, {
      x: MARGIN_X,
      y: ctx.y,
      size,
      font: ctx.font,
      color: INK_MUTED,
    });
    ctx.y -= lineH;
  }
  ctx.y -= 6;
}

function drawMetaRow(ctx: DrawCtx, pairs: Array<[string, string]>) {
  ensureSpace(ctx, 52);
  const colW = CONTENT_W / 2;
  for (let i = 0; i < pairs.length; i += 2) {
    ensureSpace(ctx, 28);
    const left = pairs[i];
    const right = pairs[i + 1];
    const rowY = ctx.y;
    for (const [col, pair] of [
      [0, left],
      [1, right],
    ] as const) {
      if (!pair) continue;
      const x = MARGIN_X + col * colW;
      ctx.page.drawText(pair[0].toUpperCase(), {
        x,
        y: rowY,
        size: 7.5,
        font: ctx.bold,
        color: INK_SUBTLE,
      });
      const valueLines = wrapText(ctx.font, pair[1] || '—', 10, colW - 12);
      let vy = rowY - 13;
      for (const line of valueLines.slice(0, 2)) {
        ctx.page.drawText(line, { x, y: vy, size: 10, font: ctx.font, color: INK });
        vy -= 12;
      }
    }
    ctx.y -= 34;
  }
}

export async function generateJobDescriptionPdf(
  jd: JobDescriptionDetailDto,
  branding: JdPdfBranding,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const mark = await embedMark(doc);

  const ctx: DrawCtx = {
    doc,
    page,
    font,
    bold,
    y: PAGE_H,
    branding,
    pageIndex: 1,
  };

  // Header band
  const headerH = 72;
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_H - headerH,
    width: PAGE_W,
    height: headerH,
    color: INK,
  });
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_H - headerH,
    width: 6,
    height: headerH,
    color: CORAL,
  });

  if (mark) {
    const markH = 28;
    const markW = (mark.width / mark.height) * markH;
    ctx.page.drawImage(mark, {
      x: MARGIN_X + 4,
      y: PAGE_H - 48,
      width: markW,
      height: markH,
    });
  }

  const orgLabel = pdfSafe(branding.orgName || brand.orgName || 'Organization');
  const orgW = bold.widthOfTextAtSize(orgLabel, 9);
  ctx.page.drawText(orgLabel, {
    x: PAGE_W - MARGIN_X - orgW,
    y: PAGE_H - 28,
    size: 9,
    font: bold,
    color: WHITE,
  });
  ctx.page.drawText('JOB DESCRIPTION', {
    x: PAGE_W - MARGIN_X - font.widthOfTextAtSize('JOB DESCRIPTION', 8),
    y: PAGE_H - 42,
    size: 8,
    font,
    color: rgb(0.75, 0.72, 0.68),
  });

  ctx.y = PAGE_H - headerH - 28;

  // Title block
  const titleLines = wrapText(bold, jd.title, 18, CONTENT_W - 120);
  for (const line of titleLines) {
    ctx.page.drawText(line, { x: MARGIN_X, y: ctx.y, size: 18, font: bold, color: INK });
    ctx.y -= 22;
  }

  const badgeParts = [jd.grade, jd.divisionName, jd.status === 'published' ? 'Published' : jd.status]
    .filter(Boolean)
    .map(String);
  if (badgeParts.length) {
    ctx.y -= 4;
    ctx.page.drawText(pdfSafe(badgeParts.join('  ·  ')), {
      x: MARGIN_X,
      y: ctx.y,
      size: 10,
      font,
      color: INK_MUTED,
    });
    ctx.y -= 18;
  }

  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - 4,
    width: CONTENT_W,
    height: 1,
    color: LINE,
  });
  ctx.y -= 22;

  drawMetaRow(ctx, [
    ['Job title', jd.title],
    ['Division', jd.divisionName ?? '—'],
    ['Grade', jd.grade ?? '—'],
    ['Version', `v${jd.version}`],
    ['Status', jd.status],
    [
      'Published',
      jd.publishedAt
        ? new Date(jd.publishedAt).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : '—',
    ],
  ]);

  drawSectionTitle(ctx, 'Job purpose');
  drawBody(ctx, jd.jobPurpose);

  drawSectionTitle(ctx, 'Key activities');
  drawBody(ctx, jd.keyActivities);

  drawSectionTitle(ctx, 'Authority & scope');
  drawBody(ctx, jd.authorityScope);

  drawSectionTitle(ctx, 'Working conditions');
  drawBody(ctx, jd.workingConditions);

  drawSectionTitle(ctx, 'Qualifications');
  drawBody(ctx, jd.qualifications);

  drawSectionTitle(ctx, 'Relationships');
  drawBody(ctx, jd.relationships);

  // KRAs
  drawSectionTitle(ctx, 'Key result areas');
  if (jd.kras.length === 0) {
    drawBody(ctx, 'No KRAs defined.');
  } else {
    jd.kras.forEach((kra, index) => {
      ensureSpace(ctx, 48);
      const kraTitle = pdfSafe(`${index + 1}. ${kra.title}`);
      ctx.page.drawText(kraTitle, {
        x: MARGIN_X,
        y: ctx.y,
        size: 11,
        font: bold,
        color: INK,
      });
      ctx.y -= 14;
      const meta = [
        kra.bscPerspective ? PERSPECTIVE_LABEL[kra.bscPerspective] ?? kra.bscPerspective : null,
        `${kra.weightPercent}% weight`,
      ]
        .filter(Boolean)
        .join('  ·  ');
      if (meta) {
        ctx.page.drawText(pdfSafe(meta), {
          x: MARGIN_X,
          y: ctx.y,
          size: 8.5,
          font,
          color: INK_SUBTLE,
        });
        ctx.y -= 12;
      }
      if (kra.description) drawBody(ctx, kra.description, 9.5);
      else ctx.y -= 4;

      if (kra.kpis.length) {
        ensureSpace(ctx, 28);
        // KPI table header
        ctx.page.drawRectangle({
          x: MARGIN_X,
          y: ctx.y - 4,
          width: CONTENT_W,
          height: 18,
          color: PAPER_2,
        });
        ctx.page.drawText('#', { x: MARGIN_X + 8, y: ctx.y, size: 8, font: bold, color: INK_SUBTLE });
        ctx.page.drawText('KEY PERFORMANCE INDICATOR', {
          x: MARGIN_X + 28,
          y: ctx.y,
          size: 8,
          font: bold,
          color: INK_SUBTLE,
        });
        ctx.page.drawText('TARGET', {
          x: MARGIN_X + CONTENT_W - 110,
          y: ctx.y,
          size: 8,
          font: bold,
          color: INK_SUBTLE,
        });
        ctx.y -= 20;

        kra.kpis.forEach((kpi, kpiIdx) => {
          const target = pdfSafe([kpi.targetValue, kpi.unit].filter(Boolean).join(' ')) || '—';
          const nameLines = wrapText(font, kpi.name, 9.5, CONTENT_W - 150);
          const rowH = Math.max(16, nameLines.length * 12 + 4);
          ensureSpace(ctx, rowH + 4);
          ctx.page.drawText(String(kpiIdx + 1), {
            x: MARGIN_X + 8,
            y: ctx.y,
            size: 9.5,
            font,
            color: INK_MUTED,
          });
          let ny = ctx.y;
          for (const line of nameLines) {
            ctx.page.drawText(line, {
              x: MARGIN_X + 28,
              y: ny,
              size: 9.5,
              font,
              color: INK,
            });
            ny -= 12;
          }
          ctx.page.drawText(target, {
            x: MARGIN_X + CONTENT_W - 110,
            y: ctx.y,
            size: 9.5,
            font,
            color: INK_MUTED,
          });
          ctx.y -= rowH;
        });
        ctx.y -= 8;
      }
    });
  }

  // Competencies
  drawSectionTitle(ctx, 'Knowledge, skills & competencies');
  if (jd.competencies.length === 0) {
    drawBody(ctx, 'No competencies defined.');
  } else {
    ensureSpace(ctx, 28);
    ctx.page.drawRectangle({
      x: MARGIN_X,
      y: ctx.y - 4,
      width: CONTENT_W,
      height: 18,
      color: PAPER_2,
    });
    ctx.page.drawText('COMPETENCY', {
      x: MARGIN_X + 8,
      y: ctx.y,
      size: 8,
      font: bold,
      color: INK_SUBTLE,
    });
    ctx.page.drawText('REQUIRED LEVEL (1–5)', {
      x: MARGIN_X + CONTENT_W - 130,
      y: ctx.y,
      size: 8,
      font: bold,
      color: INK_SUBTLE,
    });
    ctx.y -= 20;

    for (const competency of jd.competencies) {
      const nameLines = wrapText(font, competency.name, 10, CONTENT_W - 150);
      const rowH = Math.max(16, nameLines.length * 12 + 4);
      ensureSpace(ctx, rowH + 4);
      let ny = ctx.y;
      for (const line of nameLines) {
        ctx.page.drawText(line, { x: MARGIN_X + 8, y: ny, size: 10, font, color: INK });
        ny -= 12;
      }
      ctx.page.drawText(String(competency.requiredLevel), {
        x: MARGIN_X + CONTENT_W - 40,
        y: ctx.y,
        size: 10,
        font: bold,
        color: INK,
      });
      ctx.y -= rowH;
    }
  }

  drawFooter(ctx);
  return Buffer.from(await doc.save());
}

export function jdPdfFilename(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `job-description-${slug || 'role'}.pdf`;
}
