import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const b = body as { kind?: string; latitude?: number; longitude?: number };
  const kind = b.kind === 'check_out' ? 'check_out' : 'check_in';

  const employee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: { id: true, outsourcingClientId: true },
  });
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  const now = new Date();
  const workDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const event = await prisma.attendanceEvent.create({
    data: {
      employeeId: employee.id,
      outsourcingClientId: employee.outsourcingClientId,
      observedAt: now,
      workDate,
      source: 'manual',
      kind,
      notes: 'ESS mobile clock',
      metadata: {
        channel: 'ess_pwa',
        latitude: typeof b.latitude === 'number' ? b.latitude : null,
        longitude: typeof b.longitude === 'number' ? b.longitude : null,
      },
    },
  });

  return NextResponse.json({
    id: event.id,
    kind: event.kind,
    observedAt: event.observedAt.toISOString(),
  });
}
