#!/usr/bin/env node
/**
 * Generate Backbone HR B2B Sales Reference PDF using system Chrome.
 * Usage: node scripts/generate-sales-pdf.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mdPath = join(root, 'docs/B2B-SALES-REFERENCE.md');
const cssPath = join(root, 'docs/sales-pdf-style.css');
const htmlPath = join(root, 'docs/B2B-SALES-REFERENCE.html');
const pdfPath = join(root, 'docs/Backbone-HR-B2B-Sales-Reference.pdf');

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

function findChrome() {
  for (const p of CHROME_PATHS) {
    try {
      readFileSync(p);
      return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inTable = false;
  let inCode = false;
  let inList = false;
  let listType = 'ul';
  let tableRows = [];

  const flushTable = () => {
    if (!tableRows.length) return;
    out.push('<table>');
    tableRows.forEach((row, i) => {
      const tag = i === 0 ? 'th' : 'td';
      const cellTag = i === 0 ? 'th' : 'td';
      if (i === 0) {
        out.push('<thead><tr>');
        row.forEach((c) => out.push(`<th>${escapeHtml(c.trim())}</th>`));
        out.push('</tr></thead><tbody>');
      } else if (row.every((c) => /^-+$/.test(c.trim()))) {
        /* separator row */
      } else {
        out.push('<tr>');
        row.forEach((c) => out.push(`<${cellTag}>${inlineMd(c.trim())}</${cellTag}>`));
        out.push('</tr>');
      }
    });
    out.push('</tbody></table>');
    tableRows = [];
    inTable = false;
  };

  const closeList = () => {
    if (inList) {
      out.push(`</${listType}>`);
      inList = false;
    }
  };

  const inlineMd = (text) => {
    let t = escapeHtml(text);
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
    return t;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inCode) {
      if (line.startsWith('```')) {
        out.push('</code></pre>');
        inCode = false;
      } else {
        out.push(escapeHtml(line) + '\n');
      }
      continue;
    }

    if (line.startsWith('```')) {
      closeList();
      flushTable();
      out.push('<pre><code>');
      inCode = true;
      continue;
    }

    if (line.startsWith('|')) {
      closeList();
      inTable = true;
      tableRows.push(line.split('|').slice(1, -1));
      if (i + 1 >= lines.length || !lines[i + 1].startsWith('|')) flushTable();
      continue;
    }

    if (inTable) flushTable();

    if (line.startsWith('# ')) {
      closeList();
      out.push(`<h1>${inlineMd(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeList();
      out.push(`<h2>${inlineMd(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      closeList();
      out.push(`<h3>${inlineMd(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('#### ')) {
      closeList();
      out.push(`<h4>${inlineMd(line.slice(5))}</h4>`);
      continue;
    }

    if (line.startsWith('> ')) {
      closeList();
      out.push(`<blockquote><p>${inlineMd(line.slice(2))}</p></blockquote>`);
      continue;
    }

    if (line === '---') {
      closeList();
      out.push('<hr>');
      continue;
    }

    const ulMatch = line.match(/^[-*] (.+)$/);
    const olMatch = line.match(/^\d+\. (.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        out.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      out.push(`<li>${inlineMd(ulMatch[1])}</li>`);
      continue;
    }
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList();
        out.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      out.push(`<li>${inlineMd(olMatch[1])}</li>`);
      continue;
    }

    closeList();

    if (line.trim() === '') {
      continue;
    }

    out.push(`<p>${inlineMd(line)}</p>`);
  }

  closeList();
  flushTable();
  if (inCode) out.push('</code></pre>');

  return out.join('\n');
}

const md = readFileSync(mdPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Backbone HR — B2B Sales Reference Guide</title>
  <style>${css}</style>
</head>
<body>
  <div class="confidential">Internal — Confidential</div>
  ${mdToHtml(md)}
  <div class="footer-note">Raven Tech Group · Backbone HR · B2B Sales Reference · June 2026</div>
</body>
</html>`;

writeFileSync(htmlPath, html);

const chrome = findChrome();
if (!chrome) {
  console.error('Chrome not found. Open docs/B2B-SALES-REFERENCE.html and print to PDF manually.');
  process.exit(1);
}

const result = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--print-to-pdf=${pdfPath}`,
    '--print-to-pdf-no-header',
    `file://${htmlPath}`,
  ],
  { encoding: 'utf8' },
);

if (result.status !== 0) {
  console.error('Chrome PDF generation failed:', result.stderr || result.stdout);
  process.exit(1);
}

console.log(`PDF written to: ${pdfPath}`);
