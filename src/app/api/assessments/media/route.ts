import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { withTenant } from '@/lib/tenant-api';

const MAX_SIZE = 4.5 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/** Upload an image used inside a question prompt. */
export async function POST(request: NextRequest) {
  return withTenant(request, async () => {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'file is required.' }, { status: 400 });
    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Only PNG/JPEG/GIF/WEBP images allowed.' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Image too large (max 4.5MB).' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
    const key = `assessment-media/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(key, buffer, { access: 'public', contentType: file.type });
      return NextResponse.json({ url: blob.url });
    }

    const dir = path.join(process.cwd(), 'public', 'uploads', 'assessment-media');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, path.basename(key)), buffer);
    return NextResponse.json({ url: `/uploads/assessment-media/${path.basename(key)}` });
  });
}
