import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';
import { FileValidationError, validatePdfUpload } from '@/lib/file-upload-validation';

const MAX_SIZE = 4.5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('resume') as File | null;
    const validated = await validatePdfUpload(file as File, {
      maxBytes: MAX_SIZE,
      fieldLabel: 'CV',
    });

    const ext = '.pdf';
    const safeName = `resumes/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const buffer = validated.buffer;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(safeName, buffer, {
        access: 'public',
        contentType: validated.mimeType,
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
    if (err instanceof FileValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Resume upload error:', err);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
