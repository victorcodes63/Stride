/**
 * Dev-only: Send a sample interview invite to any email for testing.
 * Only enabled when NODE_ENV=development.
 * POST { "to": "test@example.com" }
 */
import { NextRequest, NextResponse } from 'next/server';
import { sendInterviewInviteEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production.' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const to = typeof (body as { to?: string }).to === 'string' ? (body as { to: string }).to.trim() : '';
  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'Valid "to" email required.' }, { status: 400 });
  }

  const result = await sendInterviewInviteEmail({
    interviewId: 'test-invite',
    to,
    candidateFirstName: 'Victor',
    jobTitle: 'Operations Manager',
    companyName: 'Apex Healthcare Group',
    scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 45,
    type: 'video',
    locationOrLink: 'https://meet.google.com/abc-defg-hij',
  });

  if (result.sent) {
    return NextResponse.json({ success: true, message: `Test invite sent to ${to}` });
  }
  return NextResponse.json(
    { success: false, error: result.error, reason: result.reason },
    { status: 500 }
  );
}
