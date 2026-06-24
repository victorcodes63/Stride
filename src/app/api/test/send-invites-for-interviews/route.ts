/**
 * Dev-only: Send real interview invite emails for given interview IDs.
 * Only enabled when NODE_ENV=development.
 * POST { "interviewIds": ["id1", "id2"] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInterviewInviteEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Not available in production.' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const interviewIds = Array.isArray((body as { interviewIds?: string[] }).interviewIds)
    ? (body as { interviewIds: string[] }).interviewIds.filter((id) => typeof id === 'string')
    : [];
  if (interviewIds.length === 0) {
    return NextResponse.json({ error: 'interviewIds array required (at least one).' }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const results: { interviewId: string; to: string; sent: boolean; error?: string }[] = [];

  for (const interviewId of interviewIds) {
    try {
      const interview = await prisma.interview.findUnique({
        where: { id: interviewId },
        include: {
          application: {
            include: { candidate: true, job: true },
          },
        },
      });
      if (!interview) {
        results.push({ interviewId, to: '', sent: false, error: 'Interview not found.' });
        continue;
      }
      if (interview.status !== 'scheduled') {
        results.push({ interviewId, to: interview.application.candidate.email, sent: false, error: 'Interview not scheduled.' });
        continue;
      }
      const candidate = interview.application.candidate;
      const job = interview.application.job;
      const result = await sendInterviewInviteEmail({
        interviewId: interview.id,
        to: candidate.email,
        candidateFirstName: candidate.firstName,
        jobTitle: job.title,
        companyName: job.company,
        scheduledAt: interview.scheduledAt.toISOString(),
        durationMinutes: interview.durationMinutes,
        type: interview.type,
        locationOrLink: interview.locationOrLink,
        notes: interview.notes,
        officialLetterPath: interview.officialLetterPath,
      });
      if (result.sent) {
        await prisma.interview.update({
          where: { id: interviewId },
          data: { inviteSentAt: new Date() },
        });
        results.push({ interviewId, to: candidate.email, sent: true });
      } else {
        results.push({ interviewId, to: candidate.email, sent: false, error: result.error || 'Failed to send.' });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ interviewId, to: '', sent: false, error: msg });
    }
  }

  return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[send-invites-for-interviews]', msg, stack);
    return NextResponse.json({ error: msg, stack: process.env.NODE_ENV === 'development' ? stack : undefined }, { status: 500 });
  }
}
