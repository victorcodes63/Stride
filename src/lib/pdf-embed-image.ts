import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { PDFDocument } from 'pdf-lib';

/** Embed a tenant logo from a public path or remote URL into a PDF document. */
export async function embedImageFromUrl(doc: PDFDocument, logoUrl: string) {
  if (!logoUrl.trim()) return null;

  try {
    let bytes: Buffer;
    let contentType = '';
    if (logoUrl.startsWith('/')) {
      const path = join(process.cwd(), 'public', logoUrl.replace(/^\//, ''));
      if (!existsSync(path)) return null;
      bytes = readFileSync(path);
    } else if (logoUrl.startsWith('http')) {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      contentType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
      bytes = Buffer.from(await res.arrayBuffer());
    } else {
      return null;
    }

    const lower = logoUrl.toLowerCase();
    const looksJpg =
      contentType === 'image/jpeg' ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.includes('.jpg?') ||
      lower.includes('.jpeg?');
    if (looksJpg) {
      return doc.embedJpg(bytes);
    }
    // png / webp / unknown — try PNG first (most tenant logos), then JPG.
    try {
      return await doc.embedPng(bytes);
    } catch {
      return doc.embedJpg(bytes);
    }
  } catch {
    return null;
  }
}
