import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';

export const MAX_ATTACHMENT_SIZE = 4.5 * 1024 * 1024;

export type StoredFile = {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  contentType: string | null;
};

/**
 * Persist an uploaded file for the projects module. Mirrors the announcement
 * attachment pattern: use Vercel Blob when a token is configured, otherwise
 * fall back to the local `public/uploads` directory (dev / self-host).
 *
 * `keyPrefix` groups blobs, e.g. `projects/<projectId>` or `projects/<projectId>/tasks/<taskId>`.
 */
export async function storeProjectAttachment(file: File, keyPrefix: string): Promise<StoredFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'attachment';
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;
  const key = `${keyPrefix}/${uniqueName}`;

  let fileUrl: string;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, buffer, {
      access: 'public',
      contentType: file.type || 'application/octet-stream',
    });
    fileUrl = blob.url;
  } else {
    const dir = path.join(process.cwd(), 'public', 'uploads', keyPrefix);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, uniqueName), buffer);
    fileUrl = `/uploads/${keyPrefix}/${uniqueName}`;
  }

  return {
    fileName: file.name,
    fileUrl,
    fileSize: file.size,
    contentType: file.type || null,
  };
}

/** Validate an uploaded form file. Returns an error message or null. */
export function validateUploadFile(file: unknown): string | null {
  if (!(file instanceof File)) return 'file is required.';
  if (file.size === 0) return 'File is empty.';
  if (file.size > MAX_ATTACHMENT_SIZE) return 'File too large (max 4.5MB).';
  return null;
}
