import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { AssessmentTokenNotFoundError, withAssessmentAccessToken } from '@/lib/assessment-token-context';
import { recordUsage } from '@/lib/assessments/usage';

const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/webm',
  'video/mp4',
]);

/** Candidate upload endpoint for file answers, video responses, and webcam snapshots. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return await withAssessmentAccessToken(token, async (tx) => {
      const attempt = await tx.applicationAssessmentAttempt.findUnique({
        where: { accessToken: token },
        select: { id: true, organizationId: true, status: true },
      });
      if (!attempt) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
      if (attempt.status !== 'in_progress') {
        return NextResponse.json({ error: 'Assessment is not in progress.' }, { status: 409 });
      }

      const form = await request.formData();
      const file = form.get('file');
      const kind = String(form.get('kind') ?? 'answer');
      if (!(file instanceof File)) return NextResponse.json({ error: 'file is required.' }, { status: 400 });
      if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
      if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 8MB).' }, { status: 400 });

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.includes('.') ? file.name.split('.').pop() : file.type.split('/')[1];
      const key = `assessment-uploads/${attempt.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      let url: string;
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const blob = await put(key, buffer, { access: 'public', contentType: file.type });
        url = blob.url;
      } else {
        const dir = path.join(process.cwd(), 'public', 'uploads', 'assessment-uploads', attempt.id);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, path.basename(key)), buffer);
        url = `/uploads/assessment-uploads/${attempt.id}/${path.basename(key)}`;
      }

      if (kind === 'webcam') {
        await recordUsage(attempt.organizationId, { type: 'proctoring_snapshot', tx });
      }
      return NextResponse.json({ url });
    });
  } catch (error) {
    if (error instanceof AssessmentTokenNotFoundError) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }
    throw error;
  }
}
