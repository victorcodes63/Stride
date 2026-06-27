import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { ratingLabel } from '@/lib/performance/service';
import { withEssTenant } from '@/lib/ess-tenant-api';

async function getTeamEmployeeIds(tx: Prisma.TransactionClient, managerEmployeeId: string, organizationId: string) {
  return (
    await tx.employee.findMany({
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
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId || ctx.essUser.role !== 'manager') {
      return NextResponse.json({ reviews: [], cycle: null });
    }

    const result = await ctx.run(async (tx) => {
      const teamIds = await getTeamEmployeeIds(tx, ctx.employeeId!, ctx.organizationId);
      if (teamIds.length === 0) {
        return { reviews: [], cycle: null };
      }

      const activeCycle = await tx.performanceCycle.findFirst({
        where: ctx.where({ status: 'active' }),
        orderBy: { activatedAt: 'desc' },
      });

      if (!activeCycle) {
        return { reviews: [], cycle: null };
      }

      const reviews = await tx.performanceReview.findMany({
        where: ctx.where({
          cycleId: activeCycle.id,
          employeeId: { in: teamIds },
          status: { in: ['self_submitted', 'manager_in_progress', 'completed'] },
        }),
        include: {
          employee: {
            select: { firstName: true, lastName: true, employeeNumber: true },
          },
        },
        orderBy: { employee: { lastName: 'asc' } },
      });

      return {
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
      };
    });

    return NextResponse.json(result);
  });
}
