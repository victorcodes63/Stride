import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: 'No employee profile' }, { status: 400 });

  const { id } = await context.params;
  const grievance = await prisma.grievance.findFirst({
    where: { id, employeeId: user.employeeId },
    include: {
      against: { select: { firstName: true, lastName: true } },
      documents: { select: { id: true, title: true, fileName: true, createdAt: true } },
    },
  });

  if (!grievance) return NextResponse.json({ error: 'Grievance not found' }, { status: 404 });
  return NextResponse.json(grievance);
}
