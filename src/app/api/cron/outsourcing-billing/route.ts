import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportApiError } from '@/lib/monitoring';
import { runOutsourcingMonthlyBilling } from '@/lib/outsourcing-billing-cron';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return request.nextUrl.searchParams.get('secret') === secret;
}

/** Monthly job: generate OUT-07 draft invoices for all active end-clients. */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const result = await prisma.$transaction((tx) => runOutsourcingMonthlyBilling(tx));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/cron/outsourcing-billing',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Outsourcing billing cron failed.' }, { status: 500 });
  }
}
