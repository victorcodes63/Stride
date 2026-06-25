import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessHealthcare, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildNhifReturnExtract } from '@/lib/healthcare/nhif';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessHealthcare(user)) {
    return forbiddenResponse('Healthcare access is restricted to operations and admin users.');
  }

  const month =
    request.nextUrl.searchParams.get('month')?.trim() ??
    new Date().toISOString().slice(0, 7);

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const extract = await buildNhifReturnExtract(prisma, clientId, month);
    return NextResponse.json({ extract });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/healthcare/nhif/returns',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to build NHIF return extract.' }, { status: 500 });
  }
}
