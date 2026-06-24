import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';
import { parseStaffSession } from '@/lib/auth-session';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 4 * 1024 * 1024; // 4MB

function requireStaff(request: NextRequest): NextResponse | null {
  const raw = request.cookies.get('staff_session')?.value;
  if (!raw) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  const parsed = parseStaffSession(raw);
  if (!parsed.userId && !parsed.email) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
  }
  return null;
}

/** POST: upload featured image for an insight (staff only). Returns { url, path }. */
export async function POST(request: NextRequest) {
  const auth = requireStaff(request);
  if (auth) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing file (field: image)' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(MAX_SIZE / 1024 / 1024)}MB).` },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name) || '.jpg';
    const safeName = `insights/${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(safeName, buffer, {
        access: 'public',
        contentType: file.type,
      });
      return NextResponse.json({ url: blob.url, path: blob.url });
    }

    const dir = path.join(process.cwd(), 'public', 'uploads', 'insights');
    await mkdir(dir, { recursive: true });
    const fileName = path.basename(safeName);
    const filePath = path.join(dir, fileName);
    await writeFile(filePath, buffer);
    const url = `/uploads/insights/${fileName}`;
    return NextResponse.json({ url, path: url });
  } catch (err) {
    console.error('Insight image upload error:', err);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
