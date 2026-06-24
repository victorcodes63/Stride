import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCSV } from '@/lib/report-export';
import { downloadHeaders, jsonOrPdf, parseFormat, requireReportsUser, ymd } from '@/app/api/reports/_shared';

export async function GET(request: NextRequest) {
  const auth = await requireReportsUser(request);
  if (!auth.ok) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const format = parseFormat(request);
  const now = new Date();

  const [jobs, applications, interviews] = await Promise.all([
    prisma.job.findMany({
      select: { id: true, title: true, company: true, isActive: true, applicationCount: true, location: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.application.findMany({
      include: {
        job: { select: { title: true, company: true } },
        candidate: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { appliedDate: 'desc' },
      take: 1000,
    }),
    prisma.interview.findMany({
      where: { scheduledAt: { gte: now } },
      include: {
        application: {
          include: {
            candidate: { select: { firstName: true, lastName: true } },
            job: { select: { title: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    }),
  ]);

  const byStatus = new Map<string, number>();
  for (const app of applications) {
    byStatus.set(app.status, (byStatus.get(app.status) ?? 0) + 1);
  }

  const activeJobs = jobs.filter((j) => j.isActive).length;
  const hired = applications.filter((a) => a.status === 'hired').length;
  const conversionRate =
    applications.length > 0 ? Math.round((hired / applications.length) * 1000) / 10 : 0;

  const byJob = jobs
    .map((job) => ({
      title: job.title,
      company: job.company,
      location: job.location ?? '',
      isActive: job.isActive,
      applications: job.applicationCount ?? 0,
    }))
    .sort((a, b) => b.applications - a.applications);

  const details = applications.map((row) => ({
    candidate: `${row.candidate.firstName} ${row.candidate.lastName}`.trim(),
    email: row.candidate.email,
    jobTitle: row.job.title,
    company: row.job.company,
    status: row.status,
    appliedDate: ymd(row.appliedDate),
  }));

  const report = {
    generatedAt: ymd(now),
    activeJobs,
    totalJobs: jobs.length,
    totalApplications: applications.length,
    upcomingInterviews: interviews.length,
    hired,
    conversionRate,
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
    byJob,
    details,
  };

  if (format === 'csv') {
    const csv = toCSV(
      ['Candidate', 'Email', 'Job', 'Company', 'Status', 'Applied'],
      report.details.map((row) => [row.candidate, row.email, row.jobTitle, row.company, row.status, row.appliedDate]),
    );
    return new NextResponse(csv, {
      headers: downloadHeaders('text/csv', `recruitment-${ymd(now)}.csv`),
    });
  }

  return jsonOrPdf(format, report, 'Recruitment Report', `recruitment-${ymd(now)}.pdf`, [
    `Active jobs: ${report.activeJobs}`,
    `Applications: ${report.totalApplications}`,
    `Upcoming interviews: ${report.upcomingInterviews}`,
    `Hired: ${report.hired}`,
    `Conversion rate: ${report.conversionRate}%`,
  ]);
}
