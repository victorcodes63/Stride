import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/** Lightweight employee list for Sales deal/target forms. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    try {
      const employees = await ctx.run((tx) =>
        tx.employee.findMany({
          where: { organizationId: ctx.organizationId, employmentStatus: 'active' },
          select: { id: true, firstName: true, lastName: true, email: true },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          take: 100,
        }),
      );

      return NextResponse.json({
        employees: employees.map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`.trim(),
          email: e.email,
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/reps',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load reps.' }, { status: 500 });
    }
  });
}
