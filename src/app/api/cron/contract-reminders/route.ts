import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runContractReminders } from '@/lib/contract-reminders';
import { reportApiError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  const q = request.nextUrl.searchParams.get('secret');
  return q === secret;
}

/** Daily job (Vercel Cron or external): contract milestone + weekly post-expiry reminders, Nairobi calendar day. */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const result = await prisma.$transaction((tx) => runContractReminders(tx, { now: new Date() }));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/cron/contract-reminders',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Reminder run failed.' }, { status: 500 });
  }
}
