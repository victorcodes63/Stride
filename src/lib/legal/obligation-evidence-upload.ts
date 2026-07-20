import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';
import { DocumentUploadError } from '@/lib/document-upload';
import { FileValidationError, validatePdfUpload } from '@/lib/file-upload-validation';

const MAX_SIZE = 10 * 1024 * 1024;

/**
 * Uploads a legal obligation evidence PDF. Uses Vercel Blob when configured,
 * otherwise falls back to `public/uploads/legal-obligations/` for local dev.
 * Mirrors `src/lib/company-document-upload.ts`.
 */
export async function uploadObligationEvidence(file: File): Promise<{
  url: string;
  path: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}> {
  let validated;
  try {
    validated = await validatePdfUpload(file, {
      maxBytes: MAX_SIZE,
      fieldLabel: 'Evidence',
    });
  } catch (err) {
    if (err instanceof FileValidationError) {
      throw new DocumentUploadError(err.message, err.status);
    }
    throw err;
  }

  const ext = '.pdf';
  const safeName = `legal-obligations/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const buffer = validated.buffer;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(safeName, buffer, {
      access: 'public',
      contentType: validated.mimeType,
    });
    return {
      url: blob.url,
      path: blob.url,
      fileName: validated.fileName,
      fileSize: validated.size,
      mimeType: validated.mimeType,
    };
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'legal-obligations');
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, path.basename(safeName));
  await writeFile(filePath, buffer);
  const url = `/uploads/legal-obligations/${path.basename(safeName)}`;
  return {
    url,
    path: url,
    fileName: validated.fileName,
    fileSize: validated.size,
    mimeType: validated.mimeType,
  };
}
