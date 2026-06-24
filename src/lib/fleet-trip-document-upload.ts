import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_SIZE = 4.5 * 1024 * 1024;

export class FleetDocumentUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'FleetDocumentUploadError';
    this.status = status;
  }
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.pdf';
  }
}

export async function uploadFleetTripDocument(file: File): Promise<{
  url: string;
  path: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new FleetDocumentUploadError(
      'Only PDF, JPEG, PNG, or WebP files are accepted for trip documents.',
    );
  }
  if (file.size > MAX_SIZE) {
    throw new FleetDocumentUploadError(
      `File too large (max ${Math.round(MAX_SIZE / 1024 / 1024)}MB).`,
    );
  }

  const ext = extensionForMime(file.type);
  const safeName = `fleet/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(safeName, buffer, {
      access: 'public',
      contentType: file.type,
    });
    return { url: blob.url, path: blob.url, fileName: file.name, fileSize: file.size, mimeType: file.type };
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'fleet');
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, path.basename(safeName));
  await writeFile(filePath, buffer);
  const url = `/uploads/fleet/${path.basename(safeName)}`;
  return { url, path: url, fileName: file.name, fileSize: file.size, mimeType: file.type };
}
