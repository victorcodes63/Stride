import { NextRequest, NextResponse } from 'next/server';
import { runPreboardingSweep } from '@/lib/onboarding-preboarding';

export const dynamic = 'force-dynamic';

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get('secret') === secret;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await runPreboardingSweep();
  return NextResponse.json({ ok: true, ...result });
}
