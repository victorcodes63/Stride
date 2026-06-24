import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { dateTimeNairobi } from '@/lib/timezone';
import { computeBulkInterviewStartTimesWithCustom } from '@/lib/bulk-interview-schedule';
import type {
  InterviewWithDetails,
  InterviewType,
  InterviewDurationMinutes,
  InterviewStatus,
  ConfirmationStatus,
} from '@/types/dashboard';

const interviewCreateInclude = {
  application: {
    include: { candidate: true, job: { include: { client: true } } },
  },
} satisfies Prisma.InterviewInclude;

type InterviewCreatedWithDetails = Prisma.InterviewGetPayload<{
  include: typeof interviewCreateInclude;
}>;

const MAX_PER_SCHEDULE = 10;
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
  client?: { name: string | null } | null;
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
    clientName: job.client?.name ?? null,
    minYearsExperience: job.minYearsExperience ?? null,
    educationLevel: job.educationLevel ?? null,
    educationQualification: job.educationQualification ?? null,
    requiredCertifications: job.requiredCertifications ?? null,
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = body as {
    jobId?: string;
    date?: string;
    startTime?: string;
    durationMinutes?: number;
    type?: string;
    applicationIds?: string[];
    locationOrLink?: string;
    notes?: string;
    /** Per applicationId — overrides `type` for that interview (e.g. one video, rest onsite) */
    typesByApplication?: Record<string, string>;
    /** Per applicationId — start time HH:mm (Nairobi); omit or empty = chain after previous slot / breaks */
    timesByApplication?: Record<string, string>;
    /** Optional breaks same day (Nairobi time HH:mm) — created with interviews in one transaction */
    breaks?: { time?: string; durationMinutes?: number; label?: string; notes?: string }[];
  };
  const jobId = typeof b.jobId === 'string' ? b.jobId.trim() : '';
  const dateStr = typeof b.date === 'string' ? b.date.trim() : '';
  const startTimeStr = typeof b.startTime === 'string' ? b.startTime.trim() : '09:00';
  const durationMinutes = b.durationMinutes != null && VALID_DURATIONS.includes(b.durationMinutes as InterviewDurationMinutes)
    ? (b.durationMinutes as InterviewDurationMinutes)
    : 45;
  const type = (typeof b.type === 'string' ? b.type.trim().toLowerCase() : 'onsite') as InterviewType;
  const applicationIds = Array.isArray(b.applicationIds)
    ? b.applicationIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_PER_SCHEDULE)
    : [];
  const locationOrLink = typeof b.locationOrLink === 'string' ? b.locationOrLink.trim() || null : null;
  const notes = typeof b.notes === 'string' ? b.notes.trim() || null : null;

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required.' }, { status: 400 });
  }
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD).' }, { status: 400 });
  }
  if (applicationIds.length === 0) {
    return NextResponse.json({ error: 'applicationIds is required (at least one, max 10).' }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'type must be one of: phone, video, onsite.' }, { status: 400 });
  }
  if (!locationOrLink || locationOrLink.length === 0) {
    return NextResponse.json({ error: 'locationOrLink is required (e.g. Zoom link or office address).' }, { status: 400 });
  }

  const baseDate = dateTimeNairobi(dateStr, startTimeStr);
  if (Number.isNaN(baseDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date or start time.' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { client: true },
    });
    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }
    const applications = await prisma.application.findMany({
      where: { id: { in: applicationIds }, jobId, status: 'shortlisted' },
      include: { candidate: true, job: { include: { client: true } } },
    });
    if (applications.length !== applicationIds.length) {
      return NextResponse.json({
        error: 'Some application IDs were not found, are not shortlisted, or do not belong to this job.',
      }, { status: 400 });
    }
    const order = new Map(applicationIds.map((id, idx) => [id, idx] as const));
    applications.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    const breakRows = Array.isArray(b.breaks) ? b.breaks.slice(0, 20) : [];
    const breakCreates: { scheduledAt: Date; durationMinutes: number; label: string; notes: string | null }[] = [];
    for (const br of breakRows) {
      const timeStr = typeof br.time === 'string' ? br.time.trim() : '';
      if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) continue;
      const dm = Math.min(180, Math.max(5, parseInt(String(br.durationMinutes ?? 15), 10) || 15));
      const label =
        typeof br.label === 'string' && br.label.trim() ? br.label.trim().slice(0, 120) : 'Break';
      const notesBr =
        typeof br.notes === 'string' && br.notes.trim() ? br.notes.trim().slice(0, 2000) : null;
      const at = dateTimeNairobi(dateStr, timeStr);
      if (Number.isNaN(at.getTime())) continue;
      breakCreates.push({ scheduledAt: at, durationMinutes: dm, label, notes: notesBr });
    }

    const breaksPayloadForSchedule = breakRows
      .filter((br) => {
        const timeStr = typeof br.time === 'string' ? br.time.trim() : '';
        return timeStr && /^\d{1,2}:\d{2}$/.test(timeStr);
      })
      .map((br) => ({
        time: (typeof br.time === 'string' ? br.time.trim() : '') as string,
        durationMinutes: Math.min(180, Math.max(5, parseInt(String(br.durationMinutes ?? 15), 10) || 15)),
      }));

    const timesByApp =
      b.timesByApplication && typeof b.timesByApplication === 'object' && !Array.isArray(b.timesByApplication)
        ? (b.timesByApplication as Record<string, string>)
        : {};
    const interviewStarts = computeBulkInterviewStartTimesWithCustom(
      dateStr,
      startTimeStr,
      durationMinutes,
      applicationIds,
      breaksPayloadForSchedule,
      timesByApp
    );

    /** Array $transaction uses root client (interactive `tx` can miss `interviewScheduleBreak` in some runtimes). */
    const breakOps = breakCreates.map((br) =>
      prisma.interviewScheduleBreak.create({
        data: {
          jobId,
          scheduledAt: br.scheduledAt,
          durationMinutes: br.durationMinutes,
          label: br.label,
          notes: br.notes,
        },
      })
    );
    const typesMap =
      b.typesByApplication && typeof b.typesByApplication === 'object' && !Array.isArray(b.typesByApplication)
        ? (b.typesByApplication as Record<string, string>)
        : {};
    const interviewOps = applications.map((app, i) => {
      const raw = String(typesMap[app.id] ?? '')
        .trim()
        .toLowerCase();
      const perType = VALID_TYPES.includes(raw as InterviewType) ? (raw as InterviewType) : type;
      return prisma.interview.create({
        data: {
          applicationId: app.id,
          scheduledAt: new Date(interviewStarts[i].getTime()),
          durationMinutes,
          type: perType,
          locationOrLink,
          notes,
        },
        include: interviewCreateInclude,
      });
    });
    const results = await prisma.$transaction([...breakOps, ...interviewOps]);
    const created: InterviewWithDetails[] = (
      results.slice(breakCreates.length) as InterviewCreatedWithDetails[]
    ).map((interview) => ({
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
        job: jobToSummary(interview.application.job),
      },
    }));
    return NextResponse.json({ interviews: created, breaksCreated: breakCreates.length });
  } catch (e) {
    console.error('POST /api/interviews/bulk error:', e);
    return NextResponse.json({ error: 'Failed to create interviews.' }, { status: 500 });
  }
}
