import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInMemoryCandidates } from '@/lib/applications-store';
import type { CandidateListItem, CandidatesListApiResponse } from '@/types/dashboard';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId') || undefined;
  const minExperience = searchParams.get('minExperience');
  const maxExperience = searchParams.get('maxExperience');
  const education = searchParams.get('education') || undefined;
  const search = searchParams.get('search') || undefined;
  const employerCompany = searchParams.get('employerCompany') || undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)));
  const skip = (page - 1) * limit;

  const minExp = minExperience !== null && minExperience !== undefined && minExperience !== ''
    ? parseInt(minExperience, 10)
    : undefined;
  const maxExp = maxExperience !== null && maxExperience !== undefined && maxExperience !== ''
    ? parseInt(maxExperience, 10)
    : undefined;

  try {
    if (process.env.DATABASE_URL) {
      // When jobId is set, we want candidates who applied to this job; otherwise all candidates.
      let candidateIdsSet: Set<string> | undefined;
      if (jobId) {
        const apps = await prisma.application.findMany({
          where: { jobId },
          select: { candidateId: true },
        });
        candidateIdsSet = new Set(apps.map((a) => a.candidateId));
        if (candidateIdsSet.size === 0) {
          return NextResponse.json({ candidates: [], total: 0, page: 1, totalPages: 1 });
        }
      }
      if (employerCompany?.trim()) {
        const q = employerCompany.trim().toLowerCase();
        const apps = await prisma.application.findMany({
          select: { candidateId: true, formData: true },
        });
        const employerMatchedIds = new Set(
          apps
            .filter((a) => {
              const fd = a.formData as { employmentHistory?: { companyName?: string }[] } | null;
              return (
                fd?.employmentHistory?.some((e) =>
                  (e.companyName ?? '').toLowerCase().includes(q)
                ) ?? false
              );
            })
            .map((a) => a.candidateId)
        );
        if (!candidateIdsSet) {
          candidateIdsSet = employerMatchedIds;
        } else {
          candidateIdsSet = new Set(
            Array.from(candidateIdsSet).filter((id) => employerMatchedIds.has(id))
          );
        }
        if (candidateIdsSet.size === 0) {
          return NextResponse.json({ candidates: [], total: 0, page: 1, totalPages: 1 });
        }
      }

      const where: Record<string, unknown> = {};
      if (candidateIdsSet?.size) {
        where.id = { in: Array.from(candidateIdsSet) };
      }
      if (minExp != null && !Number.isNaN(minExp) && (maxExp == null || Number.isNaN(maxExp))) {
        where.experience = { gte: minExp };
      } else if (maxExp != null && !Number.isNaN(maxExp) && (minExp == null || Number.isNaN(minExp))) {
        where.experience = { lte: maxExp };
      } else if (minExp != null && !Number.isNaN(minExp) && maxExp != null && !Number.isNaN(maxExp)) {
        where.experience = { gte: minExp, lte: maxExp };
      }
      if (education?.trim()) {
        where.education = { contains: education.trim(), mode: 'insensitive' };
      }
      if (search?.trim()) {
        const q = search.trim();
        where.OR = [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ];
      }

      const [candidates, total] = await Promise.all([
        prisma.candidate.findMany({
          where: Object.keys(where).length ? where : undefined,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            location: true,
            experience: true,
            education: true,
            resumePath: true,
          },
        }),
        prisma.candidate.count({
          where: Object.keys(where).length ? where : undefined,
        }),
      ]);

      const list: CandidateListItem[] = candidates.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        location: c.location ?? null,
        experience: c.experience,
        education: c.education ?? null,
        resumePath: c.resumePath ?? null,
      }));

      return NextResponse.json({
        candidates: list,
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      });
    }
  } catch (_e) {
    // fall through to in-memory
  }

  const fullList = getInMemoryCandidates({
    jobId,
    minExperience: minExp,
    maxExperience: maxExp,
    education,
    search,
    employerCompany,
  });
  const total = fullList.length;
  const paginated = fullList.slice(skip, skip + limit);
  const list: CandidateListItem[] = paginated.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    location: c.location ?? null,
    experience: c.experience,
    education: c.education ?? null,
    resumePath: c.resumePath ?? null,
  }));
  return NextResponse.json({
    candidates: list,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
