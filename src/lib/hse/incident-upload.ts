import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';

const MAX_SIZE = 4.5 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
]);

const EXTENSION_BY_TYPE: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
};

export class IncidentUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'IncidentUploadError';
    this.status = status;
  }
}

export type UploadedEvidence = {
  url: string;
  fileName: string;
  fileSize: number;
  contentType: string;
};

/** Upload an incident evidence file (PDF or image) to Vercel Blob, or local disk in dev. */
export async function uploadIncidentEvidence(file: File): Promise<UploadedEvidence> {
  if (!file || typeof file === 'string') {
    throw new IncidentUploadError('Evidence file is required.');
  }
  if (file.size <= 0) {
    throw new IncidentUploadError('Evidence file is empty.');
  }
  if (file.size > MAX_SIZE) {
    throw new IncidentUploadError(
      `Evidence file too large (max ${Math.round(MAX_SIZE / 1024 / 1024)}MB).`,
    );
  }

  const declared = file.type?.trim().toLowerCase() || 'application/octet-stream';
  if (!ALLOWED_CONTENT_TYPES.has(declared)) {
    throw new IncidentUploadError('Only PDF or image files are accepted as evidence.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = EXTENSION_BY_TYPE[declared] ?? '';
  const key = `hse-evidence/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const originalName = file.name?.trim() || `evidence${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, buffer, { access: 'public', contentType: declared });
    return { url: blob.url, fileName: originalName, fileSize: file.size, contentType: declared };
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'hse-evidence');
  await mkdir(dir, { recursive: true });
  const base = path.basename(key);
  await writeFile(path.join(dir, base), buffer);
  return {
    url: `/uploads/hse-evidence/${base}`,
    fileName: originalName,
    fileSize: file.size,
    contentType: declared,
  };
}
