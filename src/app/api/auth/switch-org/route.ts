import { NextRequest, NextResponse } from 'next/server';
import { getStaffSessionMaxAgeSeconds, parseStaffSession } from '@/lib/auth-session';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolveMembershipWithLoginScope } from '@/lib/org-membership';
import { buildStaffSessionForUser } from '@/lib/staff-session-issue';
import { logAuditEvent } from '@/lib/audit-events';

const STAFF_SESSION_COOKIE = 'staff_session';

export async function POST(request: NextRequest) {
  const staff = await requireStaffUser(request);
  if (!staff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { organizationId?: string };
  const organizationId =
    typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required.' }, { status: 400 });
  }

  const membership = await resolveMembershipWithLoginScope(staff.id, organizationId);
  if (!membership) {
    return NextResponse.json({ error: 'You are not a member of that organization.' }, { status: 403 });
  }

  const raw = request.cookies.get(STAFF_SESSION_COOKIE)?.value ?? '';
  const parsed = parseStaffSession(raw);
  const provider =
    parsed.provider === 'ms' || parsed.provider === 'google' || parsed.provider === 'local'
      ? parsed.provider
      : 'local';

  const sessionValue = await buildStaffSessionForUser({
    provider,
    userId: staff.id,
    userRole: membership.role,
    email: staff.email,
    preferredOrgId: organizationId,
  });

  await logAuditEvent({
    actor: { userId: staff.id, email: staff.email, name: staff.name },
    action: 'auth.org.switched',
    entityType: 'Organization',
    entityId: organizationId,
    route: 'POST /api/auth/switch-org',
    metadata: { organizationName: membership.organization.name },
  });

  const response = NextResponse.json({
    success: true,
    currentOrgId: membership.organizationId,
    currentOrgName: membership.organization.name,
    role: membership.role,
  });
  response.cookies.set(STAFF_SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: getStaffSessionMaxAgeSeconds(),
    path: '/',
  });
  return response;
}
