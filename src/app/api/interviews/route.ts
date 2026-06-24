import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type {
  InterviewWithDetails,
  CreateInterviewBody,
  InterviewType,
  InterviewDurationMinutes,
  InterviewStatus,
  ConfirmationStatus,
} from '@/types/dashboard';

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

export async function GET(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json([]);
    }
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined; // YYYY-MM-DD
    const dateTo = searchParams.get('dateTo') || undefined;
    const status = searchParams.get('status') || undefined;
    const inviteSent = searchParams.get('inviteSent'); // 'true' | 'false'

    const where: Record<string, unknown> = {};
    if (jobId?.trim()) {
      where.application = { jobId: jobId.trim() };
    }
    if (dateFrom?.trim() || dateTo?.trim()) {
      where.scheduledAt = {};
      if (dateFrom?.trim()) {
        (where.scheduledAt as Record<string, Date>).gte = new Date(dateFrom.trim());
      }
      if (dateTo?.trim()) {
        const d = new Date(dateTo.trim());
        d.setHours(23, 59, 59, 999);
        (where.scheduledAt as Record<string, Date>).lte = d;
      }
    }
    if (status?.trim() && ['scheduled', 'completed', 'cancelled'].includes(status)) {
      where.status = status;
    }
    if (inviteSent === 'true') where.inviteSentAt = { not: null };
    if (inviteSent === 'false') where.inviteSentAt = null;

    const interviews = await prisma.interview.findMany({
      where,
      include: {
        application: {
          include: {
            candidate: true,
            job: { include: { client: true } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    const list: InterviewWithDetails[] = interviews.map((i) => ({
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
      confirmationStatus: (i.confirmationStatus ?? 'pending') as ConfirmationStatus,
      confirmationNotes: i.confirmationNotes,
      confirmationAt: i.confirmationAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      application: {
        id: i.application.id,
        status: i.application.status,
        candidate: {
          id: i.application.candidate.id,
          firstName: i.application.candidate.firstName,
          lastName: i.application.candidate.lastName,
          email: i.application.candidate.email,
          phone: i.application.candidate.phone,
          location: i.application.candidate.location,
          nationality: i.application.candidate.nationality ?? null,
          homeCounty: i.application.candidate.homeCounty ?? null,
          experience: i.application.candidate.experience,
          education: i.application.candidate.education,
          resumePath: i.application.candidate.resumePath,
          createdAt: i.application.candidate.createdAt.toISOString(),
        },
        job: jobToSummary({
          id: i.application.job.id,
          title: i.application.job.title,
          company: i.application.job.company,
          location: i.application.job.location,
          type: i.application.job.type,
          category: i.application.job.category,
          postedDate: i.application.job.postedDate,
          isActive: i.application.job.isActive,
          clientId: i.application.job.clientId ?? null,
          clientName: i.application.job.client?.name ?? null,
          minYearsExperience: i.application.job.minYearsExperience ?? null,
          educationLevel: i.application.job.educationLevel ?? null,
          educationQualification: i.application.job.educationQualification ?? null,
          requiredCertifications: i.application.job.requiredCertifications ?? null,
        }),
      },
    }));
    return NextResponse.json(list);
  } catch (e) {
    console.error('GET /api/interviews error:', e);
    return NextResponse.json({ error: 'Failed to load interviews.' }, { status: 500 });
  }
}

const VALID_TYPES: InterviewType[] = ['phone', 'video', 'onsite'];

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const applicationId = typeof b.applicationId === 'string' ? b.applicationId.trim() : '';
  const scheduledAtRaw = typeof b.scheduledAt === 'string' ? b.scheduledAt.trim() : '';
  const durationRaw = b.durationMinutes != null ? Number(b.durationMinutes) : 45;
  const durationMinutes = VALID_DURATIONS.includes(durationRaw as InterviewDurationMinutes)
    ? (durationRaw as InterviewDurationMinutes)
    : 45;
  const type = (typeof b.type === 'string' ? b.type.trim().toLowerCase() : '') as InterviewType;
  const locationOrLink = typeof b.locationOrLink === 'string' ? b.locationOrLink.trim() || undefined : undefined;
  const notes = typeof b.notes === 'string' ? b.notes.trim() || undefined : undefined;

  if (!applicationId) {
    return NextResponse.json({ error: 'applicationId is required.' }, { status: 400 });
  }
  if (!scheduledAtRaw) {
    return NextResponse.json({ error: 'scheduledAt is required (ISO datetime).' }, { status: 400 });
  }
  const scheduledAt = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: 'scheduledAt must be a valid date/time.' }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'type must be one of: phone, video, onsite.' }, { status: 400 });
  }
  if (!locationOrLink || locationOrLink.length === 0) {
    return NextResponse.json({ error: 'locationOrLink is required (e.g. Zoom link or office address).' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true },
    });
    if (!application) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }
    if (application.status !== 'shortlisted') {
      return NextResponse.json(
        { error: 'Only shortlisted applications can be scheduled for interview.' },
        { status: 409 }
      );
    }

    const interview = await prisma.interview.create({
      data: {
        applicationId,
        scheduledAt,
        durationMinutes,
        type,
        locationOrLink,
        notes,
      },
      include: {
        application: {
          include: {
            candidate: true,
            job: { include: { client: true } },
          },
        },
      },
    });

    const out: InterviewWithDetails = {
      id: interview.id,
      applicationId: interview.applicationId,
      scheduledAt: interview.scheduledAt.toISOString(),
      durationMinutes: interview.durationMinutes,
      type: interview.type as InterviewType,
      locationOrLink: interview.locationOrLink,
      notes: interview.notes,
      status: interview.status as InterviewStatus,
      inviteSentAt: interview.inviteSentAt?.toISOString() ?? null,
      officialLetterPath: interview.officialLetterPath,
      confirmationStatus: (interview.confirmationStatus ?? 'pending') as ConfirmationStatus,
      confirmationNotes: interview.confirmationNotes,
      confirmationAt: interview.confirmationAt?.toISOString() ?? null,
      createdAt: interview.createdAt.toISOString(),
      updatedAt: interview.updatedAt.toISOString(),
      application: {
        id: interview.application.id,
        status: interview.application.status,
        candidate: {
          id: interview.application.candidate.id,
          firstName: interview.application.candidate.firstName,
          lastName: interview.application.candidate.lastName,
          email: interview.application.candidate.email,
          phone: interview.application.candidate.phone,
          location: interview.application.candidate.location,
          nationality: interview.application.candidate.nationality ?? null,
          homeCounty: interview.application.candidate.homeCounty ?? null,
          experience: interview.application.candidate.experience,
          education: interview.application.candidate.education,
          resumePath: interview.application.candidate.resumePath,
          createdAt: interview.application.candidate.createdAt.toISOString(),
        },
        job: jobToSummary({
          id: interview.application.job.id,
          title: interview.application.job.title,
          company: interview.application.job.company,
          location: interview.application.job.location,
          type: interview.application.job.type,
          category: interview.application.job.category,
          postedDate: interview.application.job.postedDate,
          isActive: interview.application.job.isActive,
          clientId: interview.application.job.clientId ?? null,
          clientName: interview.application.job.client?.name ?? null,
          minYearsExperience: interview.application.job.minYearsExperience ?? null,
          educationLevel: interview.application.job.educationLevel ?? null,
          educationQualification: interview.application.job.educationQualification ?? null,
          requiredCertifications: interview.application.job.requiredCertifications ?? null,
        }),
      },
    };
    return NextResponse.json(out);
  } catch (e) {
    console.error('POST /api/interviews error:', e);
    return NextResponse.json({ error: 'Failed to create interview.' }, { status: 500 });
  }
}
