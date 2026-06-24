import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type {
  InterviewWithDetails,
  InterviewType,
  InterviewDurationMinutes,
  InterviewStatus,
  UpdateInterviewBody,
} from '@/types/dashboard';
import type { Prisma } from '@prisma/client';

const VALID_TYPES: InterviewType[] = ['phone', 'video', 'onsite'];
const VALID_DURATIONS: InterviewDurationMinutes[] = [30, 45, 60];

function jobToSummary(job: {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  category: string;
  postedDate: Date;
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
    postedDate: job.postedDate.toISOString(),
    isActive: job.isActive,
    clientId: job.clientId ?? null,
    clientName: job.clientName ?? null,
    minYearsExperience: job.minYearsExperience ?? null,
    educationLevel: job.educationLevel ?? null,
    educationQualification: job.educationQualification ?? null,
    requiredCertifications: job.requiredCertifications ?? null,
  };
}

function toInterviewWithDetails(i: Awaited<ReturnType<typeof prisma.interview.findUnique>> & { application: { candidate: unknown; job: { client: { name: string } | null } } }) {
  if (!i) return null;
  const app = i.application as {
    id: string;
    status: string;
    candidate: { id: string; firstName: string; lastName: string; email: string; phone: string | null; location: string | null; nationality: string | null; homeCounty: string | null; experience: number; education: string | null; resumePath: string | null; createdAt: Date };
    job: { id: string; title: string; company: string; location: string; type: string; category: string; postedDate: Date; isActive: boolean; clientId: string | null; client: { name: string } | null; minYearsExperience: number | null; educationLevel: string | null; educationQualification: string | null; requiredCertifications: string | null };
  };
  return {
    id: i.id,
    applicationId: i.applicationId,
    scheduledAt: i.scheduledAt.toISOString(),
    durationMinutes: i.durationMinutes,
    type: i.type as InterviewType,
    locationOrLink: i.locationOrLink,
    notes: i.notes,
    status: i.status as InterviewStatus,
    inviteSentAt: i.inviteSentAt?.toISOString() ?? null,
    officialLetterPath: i.officialLetterPath,
    confirmationStatus: (i.confirmationStatus ?? 'pending') as import('@/types/dashboard').ConfirmationStatus,
    confirmationNotes: i.confirmationNotes,
    confirmationAt: i.confirmationAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    application: {
      id: app.id,
      status: app.status as 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired',
      candidate: {
        id: app.candidate.id,
        firstName: app.candidate.firstName,
        lastName: app.candidate.lastName,
        email: app.candidate.email,
        phone: app.candidate.phone,
        location: app.candidate.location,
        nationality: app.candidate.nationality ?? null,
        homeCounty: app.candidate.homeCounty ?? null,
        experience: app.candidate.experience,
        education: app.candidate.education,
        resumePath: app.candidate.resumePath,
        createdAt: app.candidate.createdAt.toISOString(),
      },
      job: jobToSummary({
        id: app.job.id,
        title: app.job.title,
        company: app.job.company,
        location: app.job.location,
        type: app.job.type,
        category: app.job.category,
        postedDate: app.job.postedDate,
        isActive: app.job.isActive,
        clientId: app.job.clientId,
        clientName: app.job.client?.name ?? null,
        minYearsExperience: app.job.minYearsExperience,
        educationLevel: app.job.educationLevel,
        educationQualification: app.job.educationQualification,
        requiredCertifications: app.job.requiredCertifications,
      }),
    },
  } as InterviewWithDetails;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  if (!id) {
    return NextResponse.json({ error: 'Interview ID required.' }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = body as UpdateInterviewBody;
  const updates: Prisma.InterviewUpdateInput = {};
  if (b.scheduledAt !== undefined) {
    const d = new Date(b.scheduledAt);
    if (!Number.isNaN(d.getTime())) updates.scheduledAt = d;
  }
  if (b.durationMinutes !== undefined && VALID_DURATIONS.includes(b.durationMinutes)) {
    updates.durationMinutes = b.durationMinutes;
  }
  if (b.type !== undefined && VALID_TYPES.includes(b.type)) updates.type = b.type;
  if (b.locationOrLink !== undefined) {
    const loc = typeof b.locationOrLink === 'string' ? b.locationOrLink.trim() : '';
    if (!loc) {
      return NextResponse.json({ error: 'locationOrLink is required (e.g. Zoom link or office address).' }, { status: 400 });
    }
    updates.locationOrLink = loc;
  }
  if (b.notes !== undefined) updates.notes = b.notes ?? null;
  if (b.status !== undefined && ['scheduled', 'completed', 'cancelled'].includes(b.status)) {
    updates.status = b.status as InterviewStatus;
  }
  if (b.officialLetterPath !== undefined) updates.officialLetterPath = b.officialLetterPath ?? null;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const interview = await prisma.interview.update({
      where: { id },
      data: updates,
      include: {
        application: {
          include: {
            candidate: true,
            job: { include: { client: true } },
          },
        },
      },
    });
    const out = toInterviewWithDetails(interview as Parameters<typeof toInterviewWithDetails>[0]);
    return NextResponse.json(out);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return NextResponse.json({ error: 'Interview not found.' }, { status: 404 });
    }
    console.error('PATCH /api/interviews/[id] error:', e);
    return NextResponse.json({ error: 'Failed to update interview.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  if (!id) {
    return NextResponse.json({ error: 'Interview ID required.' }, { status: 400 });
  }
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    await prisma.interview.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2025') {
      return NextResponse.json({ error: 'Interview not found.' }, { status: 404 });
    }
    console.error('DELETE /api/interviews/[id] error:', e);
    return NextResponse.json({ error: 'Failed to delete interview.' }, { status: 500 });
  }
}
