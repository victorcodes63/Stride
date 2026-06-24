import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getInMemoryApplicationById,
  updateInMemoryApplicationStatus,
  updateInMemoryApplicationNotes,
} from '@/lib/applications-store';
import { reportApiError } from '@/lib/monitoring';
import type { ApplicationWithDetails, ApplicationStatus } from '@/types/dashboard';

function jobToSummary(job: {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  category: string;
  postedDate: string;
  isActive: boolean;
  clientId?: string | null;
  clientName?: string | null;
  minYearsExperience?: number | null;
  educationLevel?: string | null;
  educationQualification?: string | null;
  requiredCertifications?: string | null;
}) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    type: job.type,
    category: job.category,
    postedDate: job.postedDate,
    isActive: job.isActive,
    clientId: job.clientId ?? null,
    clientName: job.clientName ?? null,
    minYearsExperience: job.minYearsExperience ?? null,
    educationLevel: job.educationLevel ?? null,
    educationQualification: job.educationQualification ?? null,
    requiredCertifications: job.requiredCertifications ?? null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Application id required' }, { status: 400 });
  }

  try {
    if (process.env.DATABASE_URL) {
      const application = await prisma.application.findUnique({
        where: { id },
        include: { candidate: true, job: { include: { client: true } } },
      });
      if (!application) {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
      }
      const result: ApplicationWithDetails = {
        id: application.id,
        jobId: application.jobId,
        candidateId: application.candidateId,
        status: application.status,
        appliedDate: application.appliedDate.toISOString(),
        coverLetter: application.coverLetter,
        resumePath: application.resumePath,
        salaryExpectations: application.salaryExpectations ?? null,
        notes: application.notes,
        formData: (application.formData as ApplicationWithDetails['formData']) ?? null,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
        candidate: {
          id: application.candidate.id,
          firstName: application.candidate.firstName,
          lastName: application.candidate.lastName,
          email: application.candidate.email,
          phone: application.candidate.phone,
          location: application.candidate.location,
          nationality: application.candidate.nationality ?? null,
          homeCounty: application.candidate.homeCounty ?? null,
          experience: application.candidate.experience,
          education: application.candidate.education,
          resumePath: application.candidate.resumePath,
          createdAt: application.candidate.createdAt.toISOString(),
        },
        job: jobToSummary({
          id: application.job.id,
          title: application.job.title,
          company: application.job.company,
          location: application.job.location,
          type: application.job.type,
          category: application.job.category,
          postedDate: application.job.postedDate.toISOString(),
          isActive: application.job.isActive,
          clientId: application.job.clientId ?? null,
          clientName: application.job.client?.name ?? null,
          minYearsExperience: application.job.minYearsExperience ?? null,
          educationLevel: application.job.educationLevel ?? null,
          educationQualification: application.job.educationQualification ?? null,
          requiredCertifications: application.job.requiredCertifications ?? null,
        }),
      };
      return NextResponse.json(result);
    }
  } catch (_e) {
    // fall through
  }

  const app = getInMemoryApplicationById(id);
  if (!app) {
    return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  }
  return NextResponse.json(app);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Application id required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const status = typeof b.status === 'string' ? b.status : undefined;
  const notes = typeof b.notes === 'string' ? b.notes : undefined;

  const validStatuses: ApplicationStatus[] = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'];
  if (status && !validStatuses.includes(status as ApplicationStatus)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  try {
    if (process.env.DATABASE_URL) {
      const application = await prisma.application.update({
        where: { id },
        data: {
          ...(status && { status: status as ApplicationStatus }),
          ...(notes !== undefined && { notes }),
        },
        include: { candidate: true, job: { include: { client: true } } },
      });
      const result: ApplicationWithDetails = {
        id: application.id,
        jobId: application.jobId,
        candidateId: application.candidateId,
        status: application.status,
        appliedDate: application.appliedDate.toISOString(),
        coverLetter: application.coverLetter,
        resumePath: application.resumePath,
        salaryExpectations: application.salaryExpectations ?? null,
        notes: application.notes,
        formData: (application.formData as ApplicationWithDetails['formData']) ?? null,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
        candidate: {
          id: application.candidate.id,
          firstName: application.candidate.firstName,
          lastName: application.candidate.lastName,
          email: application.candidate.email,
          phone: application.candidate.phone,
          location: application.candidate.location,
          nationality: application.candidate.nationality ?? null,
          homeCounty: application.candidate.homeCounty ?? null,
          experience: application.candidate.experience,
          education: application.candidate.education,
          resumePath: application.candidate.resumePath,
          createdAt: application.candidate.createdAt.toISOString(),
        },
        job: jobToSummary({
          id: application.job.id,
          title: application.job.title,
          company: application.job.company,
          location: application.job.location,
          type: application.job.type,
          category: application.job.category,
          postedDate: application.job.postedDate.toISOString(),
          isActive: application.job.isActive,
          clientId: application.job.clientId ?? null,
          clientName: application.job.client?.name ?? null,
          minYearsExperience: application.job.minYearsExperience ?? null,
          educationLevel: application.job.educationLevel ?? null,
          educationQualification: application.job.educationQualification ?? null,
          requiredCertifications: application.job.requiredCertifications ?? null,
        }),
      };
      return NextResponse.json(result);
    }
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }
    await reportApiError({
      route: 'PATCH /api/applications/[id]',
      message: e instanceof Error ? e.message : String(e),
      context: { id, status, hasNotes: notes !== undefined },
    });
    return NextResponse.json({ error: 'Failed to update application.' }, { status: 500 });
  }

  if (!status && notes === undefined) {
    return NextResponse.json({ error: 'status or notes required.' }, { status: 400 });
  }
  if (status) {
    const app = updateInMemoryApplicationStatus(id, status as ApplicationStatus);
    if (!app) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    if (notes !== undefined) {
      app.notes = notes;
      app.updatedAt = new Date().toISOString();
    }
    return NextResponse.json(app);
  }
  const app = updateInMemoryApplicationNotes(id, notes ?? null);
  if (!app) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  return NextResponse.json(app);
}
