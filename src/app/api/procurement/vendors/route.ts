import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportApiError } from '@/lib/monitoring';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';

export const dynamic = 'force-dynamic';

/** Read-only vendor picker for purchase requests (master data lives in Finance). */
export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
  if (moduleBlock) return moduleBlock;

  try {
    const vendors = await prisma.accountsVendor.findMany({
      select: { id: true, name: true, currency: true },
      orderBy: { name: 'asc' },
      take: 500,
    });
    return NextResponse.json({ vendors });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/procurement/vendors',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load vendors.' }, { status: 500 });
  }
}
