import { NextRequest, NextResponse } from 'next/server';
import { getInMemoryApplications } from '@/lib/applications-store';
import { getInMemoryJobs, getInMemoryJobSummary } from '@/lib/jobs-store';
import { withTenant } from '@/lib/tenant-api';

export interface JobWithShortlistedCount {
  id: string;
  title: string;
  company?: string;
  clientId?: string | null;
  clientName?: string | null;
  shortlistedCount: number;
  scheduledCount: number;
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      if (process.env.DATABASE_URL) {
        const shortlistedByJob = await ctx.run((tx) =>
          tx.application.groupBy({
            by: ['jobId'],
            where: ctx.where({ status: 'shortlisted' }),
            _count: { id: true },
          }),
        );
        const interviewCountByJob = await ctx.run((tx) =>
          tx.interview.groupBy({
            by: ['applicationId'],
            where: ctx.where({ status: 'scheduled' }),
          }),
        );
        const appIdsWithInterviews = new Set(interviewCountByJob.map((i) => i.applicationId));
        const applicationsWithInterviews = await ctx.run((tx) =>
          tx.application.findMany({
            where: ctx.where({ id: { in: Array.from(appIdsWithInterviews) } }),
            select: { jobId: true },
          }),
        );
        const scheduledByJob = applicationsWithInterviews.reduce(
          (acc, a) => {
            acc[a.jobId] = (acc[a.jobId] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        const jobIds = shortlistedByJob.map((g) => g.jobId);
        if (jobIds.length === 0) {
          return NextResponse.json([]);
        }

        const jobs = await ctx.run((tx) =>
          tx.job.findMany({
            where: ctx.where({ id: { in: jobIds } }),
            select: { id: true, title: true, company: true, clientId: true, client: { select: { name: true } } },
          }),
        );

        const shortlistedMap = Object.fromEntries(shortlistedByJob.map((g) => [g.jobId, g._count.id]));

        const result: JobWithShortlistedCount[] = jobs.map((j) => ({
          id: j.id,
          title: j.title,
          company: j.company,
          clientId: j.clientId ?? null,
          clientName: j.client?.name ?? null,
          shortlistedCount: shortlistedMap[j.id] ?? 0,
          scheduledCount: scheduledByJob[j.id] ?? 0,
        }));

        return NextResponse.json(result);
      }
    } catch {
      // fall through to in-memory
    }

    const applications = getInMemoryApplications({ status: 'shortlisted' });
    const jobsData = getInMemoryJobs();
    const shortlistedByJob = applications.reduce(
      (acc, a) => {
        acc[a.jobId] = (acc[a.jobId] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const jobIds = Object.keys(shortlistedByJob);
    const jobsList = jobsData.filter((j) => jobIds.includes(j.id));
    const result: JobWithShortlistedCount[] = jobsList
      .map((job) => {
        const summary = getInMemoryJobSummary(job.id);
        return {
          id: job.id,
          title: job.title,
          company: job.company,
          clientId: summary?.clientId ?? null,
          clientName: summary?.clientName ?? null,
          shortlistedCount: shortlistedByJob[job.id] ?? 0,
          scheduledCount: 0,
        };
      })
      .sort((a, b) => b.shortlistedCount - a.shortlistedCount);

    return NextResponse.json(result);
  });
}
