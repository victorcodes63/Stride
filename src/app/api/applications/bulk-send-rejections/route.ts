/**
 * Bulk send rejection emails for rejected applications.
 * POST { applicationIds: string[] }
 * Sends rejection email to each rejected applicant in the selection.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getInMemoryApplications } from '@/lib/applications-store';
import { sendApplicationRejectedEmail } from '@/lib/email';
import type { ApplicationWithDetails } from '@/types/dashboard';

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
  if (ids.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 applications per request.' }, { status: 400 });
  }

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

  const rejected = applications.filter((a) => a.status === 'rejected');

  if (rejected.length === 0) {
    return NextResponse.json(
      { error: 'No rejected applications found in the selection.' },
      { status: 400 }
    );
  }

  const results: { id: string; email: string; sent: boolean; error?: string }[] = [];

  for (const app of rejected) {
    const result = await sendApplicationRejectedEmail({
      to: app.candidate.email,
      applicantFirstName: app.candidate.firstName,
      jobTitle: app.job.title,
      companyName: app.job.company,
    });
    results.push({
      id: app.id,
      email: app.candidate.email,
      sent: result.sent,
      error: result.sent ? undefined : (result.error ?? result.reason),
    });
  }

  const sentCount = results.filter((r) => r.sent).length;
  const failed = results.filter((r) => !r.sent);

  return NextResponse.json({
    total: rejected.length,
    sent: sentCount,
    failed: failed.length,
    details: results,
    ...(failed.length > 0 && { failedEmails: failed.map((f) => f.email) }),
  });
}
