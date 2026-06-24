import { NextRequest, NextResponse } from 'next/server';
import { requireAdminActor } from '@/lib/admin-security';
import { syncEssUsersForAllEmployees } from '@/lib/ess-provision';
import { logAuditEvent } from '@/lib/audit-events';

export async function POST(request: NextRequest) {
  const { error, actor } = await requireAdminActor(request);
  if (error) return error;
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const result = await syncEssUsersForAllEmployees();
    await logAuditEvent({
      actor,
      action: 'ess_user.sync_employees',
      entityType: 'EssPortalUser',
      route: '/api/admin/ess-portal-users/sync-employees',
      metadata: result,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('POST /api/admin/ess-portal-users/sync-employees error:', e);
    return NextResponse.json({ error: 'Failed to sync employees to ESS users.' }, { status: 500 });
  }
}
