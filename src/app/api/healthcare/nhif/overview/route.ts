import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessHealthcare, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildNhifOverview } from '@/lib/healthcare/nhif';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessHealthcare(user)) {
    return forbiddenResponse('Healthcare access is restricted to operations and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const overview = await buildNhifOverview(prisma, clientId);
    return NextResponse.json(overview);
  } catch (error) {
    await reportApiError({
      route: 'GET /api/healthcare/nhif/overview',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load NHIF overview.' }, { status: 500 });
  }
}
