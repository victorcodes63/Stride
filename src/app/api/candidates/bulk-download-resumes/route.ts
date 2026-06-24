/**
 * Bulk download resumes for selected candidates.
 * POST { candidateIds: string[] }
 * Returns a zip of resumes. Only includes candidates that have a resume.
 */
import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { prisma } from '@/lib/prisma';
import { getInMemoryCandidates } from '@/lib/applications-store';
import type { CandidateSummary } from '@/types/dashboard';

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

async function fetchResumeBuffer(urlOrPath: string, baseUrl: string): Promise<Buffer | null> {
  try {
    const url = urlOrPath.startsWith('http')
      ? urlOrPath
      : `${baseUrl}${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const ids = (body as { candidateIds?: string[] }).candidateIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'candidateIds array required (at least one).' }, { status: 400 });
  }
  if (ids.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 candidates per download.' }, { status: 400 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000';

  let candidates: CandidateSummary[] = [];

  try {
    if (process.env.DATABASE_URL) {
      const rows = await prisma.candidate.findMany({
        where: { id: { in: ids } },
      });
      candidates = rows.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        location: c.location,
        nationality: c.nationality ?? null,
        homeCounty: c.homeCounty ?? null,
        experience: c.experience,
        education: c.education,
        resumePath: c.resumePath,
        createdAt: c.createdAt.toISOString(),
      }));
    } else {
      const all = getInMemoryCandidates();
      candidates = all.filter((c) => ids.includes(c.id));
    }
  } catch {
    return NextResponse.json({ error: 'Failed to fetch candidates.' }, { status: 500 });
  }

  const withResume = candidates.filter((c) => c.resumePath?.trim());

  if (withResume.length === 0) {
    return NextResponse.json(
      { error: 'No candidates with resumes found in the selection.' },
      { status: 400 }
    );
  }

  const archive = archiver('zip', { zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));

  const zipPromise = new Promise<Buffer>((resolve, reject) => {
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
  });

  const usedNames = new Set<string>();
  for (const c of withResume) {
    const path = c.resumePath!;
    const buffer = await fetchResumeBuffer(path, baseUrl);
    if (!buffer) continue;
    const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')) : '.pdf';
    let fileName = `${sanitizeFileName(c.firstName)}_${sanitizeFileName(c.lastName)}_CV${ext}`;
    if (usedNames.has(fileName)) {
      let n = 1;
      while (usedNames.has(`${fileName.replace(ext, '')}_${n}${ext}`)) n++;
      fileName = `${fileName.replace(ext, '')}_${n}${ext}`;
    }
    usedNames.add(fileName);
    archive.append(buffer, { name: fileName });
  }

  archive.finalize();
  const zipBuffer = await zipPromise;

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="candidate-resumes-${date}.zip"`,
      'Content-Length': String(zipBuffer.length),
    },
  });
}
