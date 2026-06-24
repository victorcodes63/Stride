import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const leaveTypes = await prisma.leaveType.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, daysPerYear: true },
  });

  return NextResponse.json(leaveTypes);
}
