import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);
const MAX_SIZE = 5 * 1024 * 1024;

export class BrandingUploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BrandingUploadError';
    this.status = status;
  }
}

function isServerlessDeploy(): boolean {
  return Boolean(process.env.VERCEL);
}

export async function uploadBrandingImage(
  file: File,
  folder: 'logo' | 'favicon' | 'careers-hero',
): Promise<{ url: string; path: string }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new BrandingUploadError('Use a JPG, PNG, WebP, or SVG image.');
  }
  if (file.size > MAX_SIZE) {
    throw new BrandingUploadError('Image must be 5MB or smaller.');
  }

  const ext =
    file.type === 'image/svg+xml'
      ? '.svg'
      : file.type === 'image/png'
        ? '.png'
        : file.type === 'image/webp'
          ? '.webp'
          : '.jpg';
  const safeName = `branding/${folder}-${Date.now()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(safeName, buffer, {
      access: 'public',
      contentType: file.type,
    });
    return { url: blob.url, path: blob.url };
  }

  if (isServerlessDeploy()) {
    throw new BrandingUploadError(
      'Logo uploads are not enabled on this deployment yet. Ask Raven Tech Group to connect file storage (Vercel Blob) for your workspace.',
      503,
    );
  }

  try {
    const dir = path.join(process.cwd(), 'public', 'uploads', 'branding');
    await mkdir(dir, { recursive: true });
    const fileName = path.basename(safeName);
    await writeFile(path.join(dir, fileName), buffer);
    const publicPath = `/uploads/branding/${fileName}`;
    return { url: publicPath, path: publicPath };
  } catch {
    throw new BrandingUploadError(
      'Could not save the image. On production, file storage must be configured.',
      503,
    );
  }
}
