/**
 * Generate interview schedule PDF for download.
 * World-class layout with Stride branding.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { existsSync, readFileSync } from 'fs';
import { getLogoFileAbsolutePath } from '@/lib/brand';

export interface InterviewSchedulePdfData {
  positionTitle: string;
  scheduleDate: string;
  venue: string;
  headers: string[];
  rows: string[][];
}

const LOGO_PATH = getLogoFileAbsolutePath();

// Brand colors (Stride)
const PRIMARY = rgb(26 / 255, 23 / 255, 20 / 255); // #1A1714 Stride ink
const GRAY_800 = rgb(38 / 255, 38 / 255, 38 / 255);
const GRAY_600 = rgb(82 / 255, 82 / 255, 82 / 255);
const GRAY_400 = rgb(163 / 255, 163 / 255, 163 / 255);
const WHITE = rgb(1, 1, 1);
const ROW_ALT = rgb(249 / 255, 250 / 255, 251 / 255); // #f9fafb
const BORDER_BLACK = rgb(0, 0, 0);
const BREAK_ROW = rgb(255 / 255, 249 / 255, 240 / 255); // secondary-50 #fff9f0 (brand orange tint)

const CELL_PADDING_X = 8;
const CELL_PADDING_Y = 10;
const HEADER_FONT_SIZE = 11;
const CELL_FONT_SIZE = 11;
const LINE_HEIGHT = 14;
const MIN_ROW_HEIGHT = 40;

/** Wrap text to multiple lines to fit cell width; returns array of lines */
function wrapText(
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  text: string,
  size: number,
  maxWidth: number
): string[] {
  if (!text?.trim()) return [''];
  const result: string[] = [];
  const words = text.split(/\s+/);
  let line = '';
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      line = trial;
    } else {
      if (line) result.push(line);
      line = '';
      let remainder = w;
      while (remainder) {
        if (font.widthOfTextAtSize(remainder, size) <= maxWidth) {
          line = remainder;
          break;
        }
        let i = 1;
        while (i < remainder.length && font.widthOfTextAtSize(remainder.slice(0, i), size) <= maxWidth) i++;
        result.push(remainder.slice(0, Math.max(1, i - 1)));
        remainder = remainder.slice(Math.max(1, i - 1));
      }
    }
  }
  if (line) result.push(line);
  return result.length ? result : [''];
}

export async function generateInterviewSchedulePdf(data: InterviewSchedulePdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const marginH = 28;
  const marginV = 32;
  const contentWidth = width - marginH * 2;
  let y = height - marginV;

  // 1. Logo (centered)
  if (existsSync(LOGO_PATH)) {
    try {
      const logoBytes = readFileSync(LOGO_PATH);
      const png = await doc.embedPng(logoBytes);
      const logoW = 86;
      const logoH = (png.height / png.width) * logoW;
      page.drawImage(png, {
        x: width / 2 - logoW / 2,
        y: y - logoH,
        width: logoW,
        height: logoH,
      });
      y -= logoH + 16;
    } catch {
      // fallback
    }
  }

  // 2. Title
  page.drawText('Interview Schedule', {
    x: width / 2 - helveticaBold.widthOfTextAtSize('Interview Schedule', 20) / 2,
    y: y - 20,
    size: 20,
    font: helveticaBold,
    color: PRIMARY,
  });
  y -= 36;

  // 3. Position (job title | company) — wrap + center if long
  const positionSize = 14;
  const positionMaxW = contentWidth - 8;
  const positionLines = wrapText(helveticaBold, data.positionTitle, positionSize, positionMaxW);
  const positionLineHeight = 18;
  for (let li = 0; li < positionLines.length; li++) {
    const line = positionLines[li] || '';
    const lw = helveticaBold.widthOfTextAtSize(line, positionSize);
    page.drawText(line, {
      x: width / 2 - lw / 2,
      y: y - positionSize - li * positionLineHeight,
      size: positionSize,
      font: helveticaBold,
      color: GRAY_800,
    });
  }
  y -= 12 + positionLines.length * positionLineHeight;

  // 4. Date (left) & Venue (right) — aligned to table edges
  const metaSize = 11;
  const dateStr = `Date: ${data.scheduleDate}`;
  const venueStr = `Venue: ${data.venue}`;
  page.drawText(dateStr, {
    x: marginH,
    y: y - metaSize,
    size: metaSize,
    font: helvetica,
    color: GRAY_600,
  });
  const venueW = helvetica.widthOfTextAtSize(venueStr, metaSize);
  page.drawText(venueStr, {
    x: marginH + contentWidth - venueW,
    y: y - metaSize,
    size: metaSize,
    font: helvetica,
    color: GRAY_600,
  });
  y -= 26;

  // 5. Table – proportional column widths for full content
  const colCount = data.headers.length;
  const hasMeetingLink = data.headers.some((h) => h.toLowerCase().includes('meeting'));
  const colRatios = hasMeetingLink
    ? [0.04, 0.18, 0.22, 0.14, 0.12, 0.18, 0.12] as const // No, Candidate, Email, Phone, Time, Meeting link, Time in
    : [0.05, 0.22, 0.28, 0.18, 0.15, 0.12] as const;   // No, Candidate, Email, Phone, Time, Time in
  const colWidthsArr = colRatios.slice(0, colCount).map((r) => contentWidth * r);

  const emptyMessage = Array(colCount).fill('');
  emptyMessage[0] = 'No interviews scheduled.';
  const rows = data.rows.length > 0 ? data.rows : [emptyMessage];
  const headerHeight = 32;

  const BREAK_SENTINEL = '__BREAK__';

  // Precompute wrapped lines and row heights
  const wrappedCells: string[][][] = [];
  const rowHeights: number[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (row[0] === BREAK_SENTINEL) {
      wrappedCells.push([]);
      rowHeights.push(Math.max(MIN_ROW_HEIGHT, LINE_HEIGHT * 2 + CELL_PADDING_Y * 2 + 8));
      continue;
    }
    let maxLines = 1;
    const cellLines: string[][] = [];
    for (let c = 0; c < colCount; c++) {
      const raw = (row[c] ?? '').trim();
      const isTimeInCol = data.headers[c]?.toLowerCase().includes('time in');
      const cellText = isTimeInCol && !raw ? '' : (raw || '—');
      const maxW = Math.max(20, colWidthsArr[c] - CELL_PADDING_X * 2);
      const lines = wrapText(helvetica, cellText, CELL_FONT_SIZE, maxW);
      cellLines.push(lines);
      maxLines = Math.max(maxLines, lines.length);
    }
    wrappedCells.push(cellLines);
    const h = Math.max(MIN_ROW_HEIGHT, maxLines * LINE_HEIGHT + CELL_PADDING_Y * 2);
    rowHeights.push(h);
  }

  const yTableTop = y;
  page.drawRectangle({
    x: marginH,
    y: y - headerHeight,
    width: contentWidth,
    height: headerHeight,
    color: PRIMARY,
    borderColor: BORDER_BLACK,
    borderWidth: 1,
  });
  let headerX = marginH;
  for (let c = 0; c < colCount; c++) {
    const label = data.headers[c];
    const w = helveticaBold.widthOfTextAtSize(label, HEADER_FONT_SIZE);
    const cw = colWidthsArr[c];
    page.drawText(label.toUpperCase(), {
      x: headerX + Math.min(CELL_PADDING_X, Math.max(0, (cw - w) / 2)),
      y: y - headerHeight + (headerHeight - HEADER_FONT_SIZE) / 2 + 2,
      size: HEADER_FONT_SIZE,
      font: helveticaBold,
      color: WHITE,
    });
    if (c < colCount - 1) {
      page.drawLine({
        start: { x: headerX + cw, y: y },
        end: { x: headerX + cw, y: y - headerHeight },
        thickness: 1,
        color: BORDER_BLACK,
      });
    }
    headerX += cw;
  }
  y -= headerHeight;

  // Data rows — fill, black grid (break = single full-width band, centered)
  for (let r = 0; r < rows.length; r++) {
    const rowHeight = rowHeights[r];
    const row = rows[r];
    const isBreakRow = row[0] === BREAK_SENTINEL;
    const isAlt = r % 2 === 1 && !isBreakRow;
    if (isBreakRow) {
      page.drawRectangle({
        x: marginH,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: BREAK_ROW,
        borderColor: BORDER_BLACK,
        borderWidth: 1,
      });
      const title = String(row[1] ?? 'Break').trim() || 'Break';
      const timeStr = String(row[2] ?? '').trim();
      const titleSize = 12;
      const timeSize = 11;
      const titleW = helveticaBold.widthOfTextAtSize(title, titleSize);
      const timeW = timeStr ? helvetica.widthOfTextAtSize(timeStr, timeSize) : 0;
      const midY = y - rowHeight / 2;
      page.drawText(title, {
        x: marginH + contentWidth / 2 - titleW / 2,
        y: midY + 8,
        size: titleSize,
        font: helveticaBold,
        color: PRIMARY,
      });
      if (timeStr) {
        page.drawText(timeStr, {
          x: marginH + contentWidth / 2 - timeW / 2,
          y: midY - 12,
          size: timeSize,
          font: helvetica,
          color: GRAY_600,
        });
      }
    } else if (isAlt) {
      page.drawRectangle({
        x: marginH,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: ROW_ALT,
        borderColor: BORDER_BLACK,
        borderWidth: 1,
      });
    } else {
      page.drawRectangle({
        x: marginH,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: WHITE,
        borderColor: BORDER_BLACK,
        borderWidth: 1,
      });
    }
    if (!isBreakRow) {
      let cellX = marginH;
      for (let c = 0; c < colCount; c++) {
        const lines = wrappedCells[r][c];
        const cw = colWidthsArr[c];
        const lineCount = lines.length;
        const textBlockHeight = lineCount * LINE_HEIGHT;
        const startY = y - rowHeight + (rowHeight - textBlockHeight) / 2 + CELL_PADDING_Y;
        for (let l = 0; l < lineCount; l++) {
          const line = lines[l] || '';
          page.drawText(line, {
            x: cellX + CELL_PADDING_X,
            y: startY + (lineCount - 1 - l) * LINE_HEIGHT,
            size: CELL_FONT_SIZE,
            font: helvetica,
            color: GRAY_800,
          });
        }
        if (c < colCount - 1) {
          page.drawLine({
            start: { x: cellX + cw, y: y },
            end: { x: cellX + cw, y: y - rowHeight },
            thickness: 1,
            color: BORDER_BLACK,
          });
        }
        cellX += cw;
      }
    }
    page.drawLine({
      start: { x: marginH, y: y - rowHeight },
      end: { x: marginH + contentWidth, y: y - rowHeight },
      thickness: 1,
      color: BORDER_BLACK,
    });
    y -= rowHeight;
  }
  const yTableBottom = y;
  page.drawLine({
    start: { x: marginH, y: yTableTop },
    end: { x: marginH, y: yTableBottom },
    thickness: 1,
    color: BORDER_BLACK,
  });
  page.drawLine({
    start: { x: marginH + contentWidth, y: yTableTop },
    end: { x: marginH + contentWidth, y: yTableBottom },
    thickness: 1,
    color: BORDER_BLACK,
  });
  page.drawLine({
    start: { x: marginH, y: yTableBottom },
    end: { x: marginH + contentWidth, y: yTableBottom },
    thickness: 1,
    color: BORDER_BLACK,
  });

  // Footer
  const footer = 'Stride • Generated schedule. For official use.';
  page.drawText(footer, {
    x: width / 2 - helvetica.widthOfTextAtSize(footer, 9) / 2,
    y: 36,
    size: 9,
    font: helvetica,
    color: GRAY_400,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
