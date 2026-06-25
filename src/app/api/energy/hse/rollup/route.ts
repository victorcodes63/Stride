import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessEnergy, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildEnergyHseRollup } from '@/lib/energy/hse-rollup';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessEnergy(user)) {
    return forbiddenResponse('Energy access is restricted to operations and admin users.');
  }

  try {
    const rollup = await buildEnergyHseRollup(prisma, user.currentOrgId);
    return NextResponse.json({ rollup });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/energy/hse/rollup',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load HSE rollup.' }, { status: 500 });
  }
}
