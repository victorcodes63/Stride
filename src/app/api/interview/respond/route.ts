import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyInterviewToken } from '@/lib/interview-token';

/** GET: Validate token and return interview summary for display (no sensitive data). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token')?.trim() || '';
  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }

  const interviewId = verifyInterviewToken(token);
  if (!interviewId) {
    return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  }

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: { application: { include: { job: true } } },
  });
  if (!interview) {
    return NextResponse.json({ error: 'Interview not found.' }, { status: 404 });
  }

  const date = new Date(interview.scheduledAt);
  return NextResponse.json({
    valid: true,
    jobTitle: interview.application.job.title,
    companyName: interview.application.job.company,
    scheduledAt: interview.scheduledAt.toISOString(),
    dateStr: date.toLocaleDateString(undefined, { dateStyle: 'long' }),
    timeStr: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    status: interview.confirmationStatus,
    type: interview.type,
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = body as { token?: string; action?: string; notes?: string };
  const token = typeof b.token === 'string' ? b.token.trim() : '';
  const action = typeof b.action === 'string' ? b.action.trim().toLowerCase() : '';
  const notes = typeof b.notes === 'string' ? b.notes.trim() || undefined : undefined;

  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }
  if (!['confirm', 'reschedule', 'withdraw'].includes(action)) {
    return NextResponse.json({ error: 'Action must be "confirm", "reschedule", or "withdraw".' }, { status: 400 });
  }

  const interviewId = verifyInterviewToken(token);
  if (!interviewId) {
    return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  }

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: { application: { include: { job: true } } },
  });

  if (!interview) {
    return NextResponse.json({ error: 'Interview not found.' }, { status: 404 });
  }
  if (interview.status !== 'scheduled') {
    return NextResponse.json({ error: 'This interview is no longer scheduled.' }, { status: 400 });
  }

  const alreadyResponded = interview.confirmationStatus && interview.confirmationStatus !== 'pending';
  if (alreadyResponded) {
    return NextResponse.json({
      success: true,
      alreadyResponded: true,
      status: interview.confirmationStatus,
      message: 'You have already responded to this invite.',
    });
  }

  const now = new Date();
  const update =
    action === 'confirm'
      ? { confirmationStatus: 'confirmed' as const, confirmationAt: now, confirmationNotes: null }
      : action === 'reschedule'
        ? { confirmationStatus: 'reschedule_requested' as const, confirmationAt: now, confirmationNotes: notes ?? null }
        : { confirmationStatus: 'withdrawn' as const, confirmationAt: now, confirmationNotes: notes ?? null };

  await prisma.interview.update({
    where: { id: interviewId },
    data: update,
  });

  const messages: Record<string, string> = {
    confirm: 'Thank you for confirming your attendance.',
    reschedule: 'We have received your request to reschedule. Our team will be in touch shortly.',
    withdraw: 'We have recorded that you wish to withdraw from this process. Thank you for letting us know.',
  };

  return NextResponse.json({
    success: true,
    status: update.confirmationStatus,
    message: messages[action],
  });
}
