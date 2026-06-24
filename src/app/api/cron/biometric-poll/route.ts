import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runBiometricIngestion } from '@/lib/biometric/run-biometric-poll';
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

/**
 * Fetches new punches from active biometric devices (Hikvision ISAPI Digest + AcsEvent poll).
 * Throttle: at most one ingest run per `BIOMETRIC_POLL_INTERVAL_SECONDS` (default 60) based on
 * `SchedulerLock` `biometric-poll`.
 */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const result = await runBiometricIngestion(prisma, { now: new Date() });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/cron/biometric-poll',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Biometric poll failed.' }, { status: 500 });
  }
}
