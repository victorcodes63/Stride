import { NextResponse } from 'next/server';
import { notifyDemoRequest, type DemoRequestPayload } from '@/lib/marketing-demo-request';

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  let body: Partial<DemoRequestPayload>;
  try {
    body = (await request.json()) as Partial<DemoRequestPayload>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const payload: DemoRequestPayload = {
    firstName: clean(body.firstName),
    lastName: clean(body.lastName),
    email: clean(body.email),
    company: clean(body.company),
    teamSize: clean(body.teamSize),
    interest: clean(body.interest) || 'Booking a demo',
    modules: Array.isArray(body.modules)
      ? body.modules.filter((m): m is string => typeof m === 'string').map((m) => m.trim()).filter(Boolean)
      : [],
    otherModule: clean(body.otherModule),
    preferredDate: clean(body.preferredDate),
    preferredTime: clean(body.preferredTime),
    message: clean(body.message),
  };

  if (!payload.firstName || !payload.lastName || !payload.email || !payload.company) {
    return NextResponse.json(
      { ok: false, error: 'First name, last name, email, and company are required.' },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return NextResponse.json({ ok: false, error: 'Enter a valid work email.' }, { status: 400 });
  }

  const result = await notifyDemoRequest(payload);

  if (!result.sent && !result.webhookSent) {
    console.warn('[marketing/demo-request] Lead captured but notifications failed:', {
      payload,
      leadId: result.leadId,
      reason: result.reason,
      error: result.error,
    });
  }

  return NextResponse.json({
    ok: true,
    leadId: result.leadId,
    notified: result.sent || result.webhookSent,
    emailSent: result.sent,
  });
}
