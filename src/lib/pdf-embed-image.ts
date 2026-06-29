import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { PDFDocument } from 'pdf-lib';

/** Embed a tenant logo from a public path or remote URL into a PDF document. */
export async function embedImageFromUrl(doc: PDFDocument, logoUrl: string) {
  if (!logoUrl.trim()) return null;

  try {
    let bytes: Buffer;
    if (logoUrl.startsWith('/')) {
      const path = join(process.cwd(), 'public', logoUrl.replace(/^\//, ''));
      if (!existsSync(path)) return null;
      bytes = readFileSync(path);
    } else if (logoUrl.startsWith('http')) {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      bytes = Buffer.from(await res.arrayBuffer());
    } else {
      return null;
    }

    const lower = logoUrl.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      return doc.embedJpg(bytes);
    }
    return doc.embedPng(bytes);
  } catch {
    return null;
  }
}
