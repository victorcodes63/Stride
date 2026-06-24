import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { prisma } from '@/lib/prisma';
import { verifyTotpCode } from '@/lib/mfa-totp';
import { logAuditEvent } from '@/lib/audit-events';
import { markSensitiveAuthCookie } from '@/lib/admin-security';

export async function POST(request: NextRequest) {
  const sessionUser = await requireStaffUser(request);
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const password = typeof body.password === 'string' ? body.password : '';
  const code = typeof body.code === 'string' ? body.code : '';

  if (!password) {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user || !user.isActive) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });

  const mfaEnabled = Boolean((user as { mfaEnabled?: boolean }).mfaEnabled);
  const mfaSecret = (user as { mfaSecret?: string | null }).mfaSecret;
  if (mfaEnabled) {
    if (!code || !mfaSecret || !verifyTotpCode(mfaSecret, code)) {
      return NextResponse.json({ error: 'Valid MFA code required.' }, { status: 401 });
    }
  }
  const response = NextResponse.json({ success: true });
  markSensitiveAuthCookie(response, user.id);
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'auth.reauth.succeeded',
    entityType: 'User',
    entityId: user.id,
    route: 'POST /api/auth/re-auth',
    metadata: { mfa: mfaEnabled },
  });
  return response;
}
