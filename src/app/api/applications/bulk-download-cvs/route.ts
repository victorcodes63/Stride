/**
 * Bulk download CVs for shortlisted applications.
 * POST { applicationIds: string[] }
 * Returns a zip of CVs. Only includes applications that are shortlisted and have a resume.
 */
import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { prisma } from '@/lib/prisma';
import { getInMemoryApplications } from '@/lib/applications-store';
import type { ApplicationWithDetails } from '@/types/dashboard';

function getResumePath(app: ApplicationWithDetails): string | null {
  return app.resumePath || app.candidate.resumePath || null;
}

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
  const ids = (body as { applicationIds?: string[] }).applicationIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'applicationIds array required (at least one).' }, { status: 400 });
  }
  if (ids.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 applications per download.' }, { status: 400 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000';

  let applications: ApplicationWithDetails[] = [];

  try {
    if (process.env.DATABASE_URL) {
      const rows = await prisma.application.findMany({
        where: { id: { in: ids } },
        include: { candidate: true, job: { include: { client: true } } },
      });
      applications = rows.map((a) => ({
        id: a.id,
        jobId: a.jobId,
        candidateId: a.candidateId,
        status: a.status,
        appliedDate: a.appliedDate.toISOString(),
        coverLetter: a.coverLetter,
        resumePath: a.resumePath,
        salaryExpectations: a.salaryExpectations ?? null,
        notes: a.notes,
        formData: a.formData as ApplicationWithDetails['formData'],
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        candidate: {
          id: a.candidate.id,
          firstName: a.candidate.firstName,
          lastName: a.candidate.lastName,
          email: a.candidate.email,
          phone: a.candidate.phone,
          location: a.candidate.location,
          nationality: a.candidate.nationality ?? null,
          homeCounty: a.candidate.homeCounty ?? null,
          experience: a.candidate.experience,
          education: a.candidate.education,
          resumePath: a.candidate.resumePath,
          createdAt: a.candidate.createdAt.toISOString(),
        },
        job: {
          id: a.job.id,
          title: a.job.title,
          company: a.job.company,
          location: a.job.location,
          type: a.job.type,
          category: a.job.category,
          postedDate: a.job.postedDate.toISOString(),
          isActive: a.job.isActive,
          clientId: a.job.clientId ?? null,
          clientName: a.job.client?.name ?? null,
          minYearsExperience: a.job.minYearsExperience ?? null,
          educationLevel: a.job.educationLevel ?? null,
          educationQualification: a.job.educationQualification ?? null,
          requiredCertifications: a.job.requiredCertifications ?? null,
        },
      }));
    } else {
      const all = getInMemoryApplications();
      applications = all.filter((a) => ids.includes(a.id));
    }
  } catch {
    return NextResponse.json({ error: 'Failed to fetch applications.' }, { status: 500 });
  }

  const shortlistedWithResume = applications.filter(
    (a) => a.status === 'shortlisted' && getResumePath(a)
  );

  if (shortlistedWithResume.length === 0) {
    return NextResponse.json(
      { error: 'No shortlisted applications with CVs found in the selection.' },
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
  for (const app of shortlistedWithResume) {
    const path = getResumePath(app);
    if (!path) continue;
    const buffer = await fetchResumeBuffer(path, baseUrl);
    if (!buffer) continue;
    const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')) : '.pdf';
    let fileName = `${sanitizeFileName(app.candidate.firstName)}_${sanitizeFileName(app.candidate.lastName)}_CV${ext}`;
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
      'Content-Disposition': `attachment; filename="shortlisted-cvs-${date}.zip"`,
      'Content-Length': String(zipBuffer.length),
    },
  });
}
