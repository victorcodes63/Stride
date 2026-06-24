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

  const dir = path.join(process.cwd(), 'public', 'uploads', 'branding');
  await mkdir(dir, { recursive: true });
  const fileName = path.basename(safeName);
  await writeFile(path.join(dir, fileName), buffer);
  const publicPath = `/uploads/branding/${fileName}`;
  return { url: publicPath, path: publicPath };
}
