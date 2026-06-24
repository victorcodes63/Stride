/**
 * Dev-only: Send a sample rejection email to any email for testing.
 * Only enabled when NODE_ENV=development.
 * POST { "to": "test@example.com" }
 */
import { NextRequest, NextResponse } from 'next/server';
import { sendApplicationRejectedEmail } from '@/lib/email';

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

  const result = await sendApplicationRejectedEmail({
    to,
    applicantFirstName: 'Victor',
    jobTitle: 'Operations Manager',
    companyName: 'Apex Healthcare Group',
  });

  if (result.sent) {
    return NextResponse.json({ success: true, message: `Test rejection email sent to ${to}` });
  }
  return NextResponse.json(
    { success: false, error: result.error, reason: result.reason },
    { status: 500 }
  );
}
