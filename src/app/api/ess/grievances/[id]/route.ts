import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.essUser.employeeId) return NextResponse.json({ error: 'No employee profile' }, { status: 400 });

    const { id } = await context.params;
    const grievance = await ctx.run((tx) =>
      tx.grievance.findFirst({
        where: ctx.where({ id, employeeId: ctx.essUser.employeeId! }),
        include: {
          against: { select: { firstName: true, lastName: true } },
          documents: { select: { id: true, title: true, fileName: true, createdAt: true } },
        },
      }),
    );

    if (!grievance) return NextResponse.json({ error: 'Grievance not found' }, { status: 404 });
    return NextResponse.json(grievance);
  });
}
