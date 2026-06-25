import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';
import { FileValidationError, validatePdfUpload } from '@/lib/file-upload-validation';

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
  let validated;
  try {
    validated = await validatePdfUpload(file, {
      maxBytes: MAX_SIZE,
      fieldLabel: 'Document',
    });
  } catch (err) {
    if (err instanceof FileValidationError) {
      throw new DocumentUploadError(err.message, err.status);
    }
    throw err;
  }

  const ext = '.pdf';
  const safeName = `documents/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const buffer = validated.buffer;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(safeName, buffer, {
      access: 'public',
      contentType: file.type,
    });
    return { url: blob.url, path: blob.url, fileName: validated.fileName, fileSize: validated.size, mimeType: validated.mimeType };
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'documents');
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, path.basename(safeName));
  await writeFile(filePath, buffer);
  const url = `/uploads/documents/${path.basename(safeName)}`;
  return { url, path: url, fileName: validated.fileName, fileSize: validated.size, mimeType: validated.mimeType };
}
