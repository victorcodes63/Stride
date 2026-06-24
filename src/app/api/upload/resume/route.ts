import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';

// PDF only so CVs can be previewed in the dashboard (Word .doc/.docx are not reliably previewable in-browser)
const ALLOWED_TYPES = ['application/pdf'];
// Vercel serverless body limit is 4.5MB; keep under for server uploads to Blob
const MAX_SIZE = 4.5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume') as File | null;
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing file (field: resume)' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'CV must be a PDF file so we can preview it. Please upload a PDF.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(MAX_SIZE / 1024 / 1024)}MB).` },
        { status: 400 }
      );
    }

    const ext = '.pdf';
    const safeName = `resumes/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Use Vercel Blob when token is set (e.g. on Vercel); otherwise local disk (dev)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(safeName, buffer, {
        access: 'public',
        contentType: file.type,
      });
      return NextResponse.json({ url: blob.url, path: blob.url });
    }

    const dir = path.join(process.cwd(), 'public', 'uploads', 'resumes');
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, path.basename(safeName));
    await writeFile(filePath, buffer);
    const url = `/uploads/resumes/${path.basename(safeName)}`;
    return NextResponse.json({ url, path: url });
  } catch (err) {
    console.error('Resume upload error:', err);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
