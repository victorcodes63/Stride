import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTeamsMeeting } from '@/lib/calendar';

/**
 * POST /api/interviews/[id]/create-teams-meeting
 * Creates a Teams/Outlook online meeting for this interview (type must be video).
 * Uses the configured Graph mailbox (e.g. recruitment@) as organizer; candidate gets
 * a calendar invite with Accept/Decline and join link. Saves the join URL to the interview.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  if (!id) {
    return NextResponse.json({ error: 'Interview ID required.' }, { status: 400 });
  }

  const mailbox =
    process.env.MS_GRAPH_MAILBOX?.trim() ||
    process.env.SMTP_USER?.trim() ||
    process.env.SMTP_FROM_EMAIL?.trim() ||
    '';
  if (!mailbox) {
    return NextResponse.json(
      { error: 'No organizer mailbox configured. Set MS_GRAPH_MAILBOX or SMTP_USER.' },
      { status: 503 }
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      application: {
        include: { candidate: true, job: true },
      },
    },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found.' }, { status: 404 });
  }
  if (interview.type !== 'video') {
    return NextResponse.json(
      { error: 'Only video interviews can have a Teams meeting. Change type to Video first.' },
      { status: 400 }
    );
  }

  const candidate = interview.application.candidate;
  const job = interview.application.job;
  const start = interview.scheduledAt;
  const durationMs = (interview.durationMinutes ?? 45) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);
  const candidateName = `${candidate.firstName} ${candidate.lastName}`.trim() || 'Candidate';
  const subject = `Interview – ${job.title} at ${job.company}`;

  const result = await createTeamsMeeting({
    organizerMailbox: mailbox,
    candidateEmail: candidate.email,
    candidateName,
    subject,
    start,
    end,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Failed to create Teams meeting.' },
      { status: 502 }
    );
  }

  await prisma.interview.update({
    where: { id },
    data: { locationOrLink: result.joinUrl },
  });

  return NextResponse.json({
    joinUrl: result.joinUrl,
    message: 'Teams meeting created. The candidate will receive a calendar invite with Accept/Decline and the join link.',
  });
}
