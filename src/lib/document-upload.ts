import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';

const ALLOWED_TYPES = new Set(['application/pdf']);
const MAX_SIZE = 4.5 * 1024 * 1024;

export class DocumentUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'DocumentUploadError';
    this.status = status;
  }
}

export async function uploadEmployeeDocument(file: File): Promise<{
  url: string;
  path: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new DocumentUploadError('Only PDF files are accepted for certificates and documents.');
  }
  if (file.size > MAX_SIZE) {
    throw new DocumentUploadError(`File too large (max ${Math.round(MAX_SIZE / 1024 / 1024)}MB).`);
  }

  const ext = '.pdf';
  const safeName = `documents/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(safeName, buffer, {
      access: 'public',
      contentType: file.type,
    });
    return { url: blob.url, path: blob.url, fileName: file.name, fileSize: file.size, mimeType: file.type };
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'documents');
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, path.basename(safeName));
  await writeFile(filePath, buffer);
  const url = `/uploads/documents/${path.basename(safeName)}`;
  return { url, path: url, fileName: file.name, fileSize: file.size, mimeType: file.type };
}
