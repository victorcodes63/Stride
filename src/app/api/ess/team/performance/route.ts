import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { ratingLabel } from '@/lib/performance/service';

async function getTeamEmployeeIds(managerEmployeeId: string, organizationId: string) {
  return (
    await prisma.employee.findMany({
      where: {
        managerEmployeeId,
        employmentStatus: 'active',
        organizationId,
      },
      select: { id: true },
    })
  ).map((e) => e.id);
}

export async function GET(request: NextRequest) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId || user.role !== 'manager') {
    return NextResponse.json({ reviews: [], cycle: null });
  }

  const manager = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: { organizationId: true },
  });
  if (!manager) return NextResponse.json({ reviews: [], cycle: null });

  const teamIds = await getTeamEmployeeIds(user.employeeId, manager.organizationId);
  if (teamIds.length === 0) {
    return NextResponse.json({ reviews: [], cycle: null });
  }

  const activeCycle = await prisma.performanceCycle.findFirst({
    where: { status: 'active', organizationId: manager.organizationId },
    orderBy: { activatedAt: 'desc' },
  });

  if (!activeCycle) {
    return NextResponse.json({ reviews: [], cycle: null });
  }

  const reviews = await prisma.performanceReview.findMany({
    where: {
      organizationId: manager.organizationId,
      cycleId: activeCycle.id,
      employeeId: { in: teamIds },
      status: { in: ['self_submitted', 'manager_in_progress', 'completed'] },
    },
    include: {
      employee: {
        select: { firstName: true, lastName: true, employeeNumber: true },
      },
    },
    orderBy: { employee: { lastName: 'asc' } },
  });

  return NextResponse.json({
    cycle: {
      id: activeCycle.id,
      name: activeCycle.name,
      periodEnd: activeCycle.periodEnd.toISOString().slice(0, 10),
    },
    reviews: reviews.map((r) => ({
      id: r.id,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
      employeeNumber: r.employee.employeeNumber,
      status: r.status,
      overallSelfRating: r.overallSelfRating,
      overallManagerRating: r.overallManagerRating,
      ratingLabel: ratingLabel(r.overallSelfRating),
    })),
  });
}
