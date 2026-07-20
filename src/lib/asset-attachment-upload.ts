import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_SIZE = 4.5 * 1024 * 1024;

export class AssetAttachmentUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AssetAttachmentUploadError';
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
    case 'image/gif':
      return '.gif';
    default:
      return '.pdf';
  }
}

export async function uploadAssetAttachment(file: File): Promise<{
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new AssetAttachmentUploadError(
      'Only PDF, JPEG, PNG, WebP, or GIF files are accepted for asset attachments.',
    );
  }
  if (file.size > MAX_SIZE) {
    throw new AssetAttachmentUploadError(
      `File too large (max ${Math.round(MAX_SIZE / 1024 / 1024)}MB).`,
    );
  }

  const ext = extensionForMime(file.type);
  const safeName = `assets/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(safeName, buffer, {
      access: 'public',
      contentType: file.type,
    });
    return { url: blob.url, fileName: file.name, fileSize: file.size, mimeType: file.type };
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'assets');
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, path.basename(safeName));
  await writeFile(filePath, buffer);
  const url = `/uploads/assets/${path.basename(safeName)}`;
  return { url, fileName: file.name, fileSize: file.size, mimeType: file.type };
}
