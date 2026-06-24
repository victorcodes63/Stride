import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInMemoryJobs } from '@/lib/jobs-store';
import {
  getInMemoryCandidates,
  getInMemoryApplications,
} from '@/lib/applications-store';
import { resolveEntityIdOrDefault, jobLocationMatchesEntity } from '@/lib/entity-request';

const LIMIT = 6;

export type SearchResultItem = {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  type: 'job' | 'candidate' | 'application';
};

export type SearchResponse = {
  jobs: SearchResultItem[];
  candidates: SearchResultItem[];
  applications: SearchResultItem[];
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  if (!q || q.length < 2) {
    return NextResponse.json({
      jobs: [],
      candidates: [],
      applications: [],
    } satisfies SearchResponse);
  }

  try {
    if (process.env.DATABASE_URL) {
      const entityId = await resolveEntityIdOrDefault(request);
      const jobGeo = jobLocationMatchesEntity(entityId);
      const [jobs, candidates, applications] = await Promise.all([
        prisma.job.findMany({
          where: {
            AND: [
              ...(jobGeo ? [jobGeo] : []),
              {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { company: { contains: q, mode: 'insensitive' } },
                  ...(q.match(/^[a-z0-9-]+$/i)
                    ? [{ referenceId: { contains: q, mode: 'insensitive' as const } }]
                    : []),
                ],
              },
            ],
          },
          select: { id: true, title: true, company: true },
          take: LIMIT,
          orderBy: { postedDate: 'desc' },
        }),
        prisma.candidate.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true, firstName: true, lastName: true, email: true },
          take: LIMIT,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.application.findMany({
          where: {
            ...(jobGeo ? { job: jobGeo } : {}),
            OR: [
              { candidate: { firstName: { contains: q, mode: 'insensitive' } } },
              { candidate: { lastName: { contains: q, mode: 'insensitive' } } },
              { candidate: { email: { contains: q, mode: 'insensitive' } } },
              { job: { title: { contains: q, mode: 'insensitive' } } },
              { job: { company: { contains: q, mode: 'insensitive' } } },
            ],
          },
          select: {
            id: true,
            candidate: { select: { firstName: true, lastName: true } },
            job: { select: { title: true } },
          },
          take: LIMIT,
          orderBy: { appliedDate: 'desc' },
        }),
      ]);

      const result: SearchResponse = {
        jobs: jobs.map((j) => ({
          id: j.id,
          type: 'job' as const,
          label: j.title,
          subtitle: j.company,
          href: `/dashboard/jobs/${j.id}`,
        })),
        candidates: candidates.map((c) => ({
          id: c.id,
          type: 'candidate' as const,
          label: `${c.firstName} ${c.lastName}`,
          subtitle: c.email,
          href: '/dashboard/candidates',
        })),
        applications: applications.map((a) => ({
          id: a.id,
          type: 'application' as const,
          label: `${a.candidate.firstName} ${a.candidate.lastName} → ${a.job.title}`,
          subtitle: 'Application',
          href: '/dashboard/applications',
        })),
      };
      return NextResponse.json(result);
    }
  } catch (_e) {
    // fall through to in-memory
  }

  // In-memory fallback
  const allJobs = getInMemoryJobs(false);
  const allCandidates = getInMemoryCandidates({ search: q });
  const allApps = getInMemoryApplications({});
  const lower = q;

  const jobMatches = allJobs.filter(
    (j) =>
      j.title.toLowerCase().includes(lower) ||
      j.company.toLowerCase().includes(lower) ||
      (j.referenceId?.toLowerCase().includes(lower) ?? false)
  ).slice(0, LIMIT);

  const candidateMatches = allCandidates.slice(0, LIMIT);

  const appMatches = allApps.filter(
    (a) =>
      `${a.candidate.firstName} ${a.candidate.lastName}`.toLowerCase().includes(lower) ||
      a.candidate.email.toLowerCase().includes(lower) ||
      a.job.title.toLowerCase().includes(lower) ||
      a.job.company.toLowerCase().includes(lower)
  ).slice(0, LIMIT);

  const result: SearchResponse = {
    jobs: jobMatches.map((j) => ({
      id: j.id,
      type: 'job',
      label: j.title,
      subtitle: j.company,
      href: `/dashboard/jobs/${j.id}`,
    })),
    candidates: candidateMatches.map((c) => ({
      id: c.id,
      type: 'candidate',
      label: `${c.firstName} ${c.lastName}`,
      subtitle: c.email,
      href: '/dashboard/candidates',
    })),
    applications: appMatches.map((a) => ({
      id: a.id,
      type: 'application',
      label: `${a.candidate.firstName} ${a.candidate.lastName} → ${a.job.title}`,
      subtitle: 'Application',
      href: '/dashboard/applications',
    })),
  };
  return NextResponse.json(result);
}
