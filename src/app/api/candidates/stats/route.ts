import { NextRequest, NextResponse } from 'next/server';
import { getInMemoryCandidates } from '@/lib/applications-store';
import { withTenant } from '@/lib/tenant-api';

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
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      if (process.env.DATABASE_URL) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [total, withResume, avgRow, addedLast30Days, withLocation] = await ctx.run((tx) =>
          Promise.all([
            tx.candidate.count({ where: ctx.where() }),
            tx.candidate.count({
              where: ctx.where({
                resumePath: { not: null },
                NOT: { resumePath: '' },
              }),
            }),
            tx.candidate.aggregate({ where: ctx.where(), _avg: { experience: true } }),
            tx.candidate.count({ where: ctx.where({ createdAt: { gte: thirtyDaysAgo } }) }),
            tx.candidate.count({
              where: ctx.where({
                location: { not: null },
                NOT: { location: '' },
              }),
            }),
          ]),
        );

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
  });
}
