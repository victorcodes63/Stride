/**
 * POST /api/contact
 * Handles contact form submissions. Sends the message to info@example.com.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sendContactFormEmail } from '@/lib/email';

const VALID_SUBJECTS = ['recruitment', 'outsourcing', 'training', 'advisory', 'payroll', 'general'];

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  const phone = typeof b.phone === 'string' ? b.phone.trim() || undefined : undefined;
  const company = typeof b.company === 'string' ? b.company.trim() || undefined : undefined;
  const subject = typeof b.subject === 'string' ? b.subject.trim() : '';
  const message = typeof b.message === 'string' ? b.message.trim() : '';

  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Name is required (at least 2 characters).' }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }
  if (!subject || !VALID_SUBJECTS.includes(subject)) {
    return NextResponse.json({ error: 'Please select a valid subject.' }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return NextResponse.json({ error: 'Message is required (at least 10 characters).' }, { status: 400 });
  }

  const result = await sendContactFormEmail({
    name,
    email,
    phone,
    company,
    subject,
    message,
  });

  if (result.sent) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: result.error || 'Failed to send message. Please try again later.' },
    { status: 500 }
  );
}
