import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInMemoryCandidates } from '@/lib/applications-store';

export type CandidatesStats = {
  total: number;
  withResume: number;
  avgExperienceYears: number;
  addedLast30Days: number;
  withLocation: number;
};

/**
 * GET /api/candidates/stats — database-wide aggregates for the Candidates page.
 */
export async function GET() {
  try {
    if (process.env.DATABASE_URL) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [total, withResume, avgRow, addedLast30Days, withLocation] = await Promise.all([
        prisma.candidate.count(),
        prisma.candidate.count({
          where: {
            resumePath: { not: null },
            NOT: { resumePath: '' },
          },
        }),
        prisma.candidate.aggregate({ _avg: { experience: true } }),
        prisma.candidate.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.candidate.count({
          where: {
            location: { not: null },
            NOT: { location: '' },
          },
        }),
      ]);

      const body: CandidatesStats = {
        total,
        withResume,
        avgExperienceYears: Math.round((avgRow._avg.experience ?? 0) * 10) / 10,
        addedLast30Days,
        withLocation,
      };
      return NextResponse.json(body);
    }
  } catch {
    // in-memory
  }

  const all = getInMemoryCandidates({});
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let withResume = 0;
  let expSum = 0;
  let addedLast30Days = 0;
  let withLocation = 0;
  for (const c of all) {
    if (c.resumePath?.trim()) withResume++;
    expSum += c.experience ?? 0;
    const created = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    if (created >= thirtyDaysAgo) addedLast30Days++;
    if (c.location?.trim()) withLocation++;
  }
  const body: CandidatesStats = {
    total: all.length,
    withResume,
    avgExperienceYears: all.length ? Math.round((expSum / all.length) * 10) / 10 : 0,
    addedLast30Days,
    withLocation,
  };
  return NextResponse.json(body);
}
