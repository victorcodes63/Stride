import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInterviewInviteEmail } from '@/lib/email';

const MAX_BULK = 50;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = body as { interviewIds?: string[]; ccEmail?: string };
  const interviewIds = Array.isArray(b.interviewIds) ? b.interviewIds.filter((id) => typeof id === 'string') : [];
  const ccEmail = typeof b.ccEmail === 'string' ? b.ccEmail.trim() || undefined : undefined;
  if (interviewIds.length === 0) {
    return NextResponse.json({ error: 'interviewIds array is required (at least one id).' }, { status: 400 });
  }
  if (interviewIds.length > MAX_BULK) {
    return NextResponse.json({ error: `Maximum ${MAX_BULK} interviews per request.` }, { status: 400 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  const results: { interviewId: string; sent: boolean; error?: string }[] = [];
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
        results.push({ interviewId, sent: false, error: 'Interview not found.' });
        continue;
      }
      if (interview.inviteSentAt) {
        results.push({ interviewId, sent: false, error: 'Invite already sent for this interview.' });
        continue;
      }
      if (interview.status !== 'scheduled') {
        results.push({ interviewId, sent: false, error: 'Interview is not scheduled.' });
        continue;
      }
      const candidate = interview.application.candidate;
      const job = interview.application.job;
      const result = await sendInterviewInviteEmail({
        interviewId: interview.id,
        to: candidate.email,
        cc: ccEmail,
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
        results.push({ interviewId, sent: true });
      } else {
        results.push({ interviewId, sent: false, error: result.error || 'Failed to send email.' });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ interviewId, sent: false, error: message });
    }
  }
  return NextResponse.json({ results });
}
