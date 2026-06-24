import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { generateBackupCodes, verifyTotpCode } from '@/lib/mfa-totp';
import { logAuditEvent } from '@/lib/audit-events';

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const code = typeof body.code === 'string' ? body.code : '';
  if (!code) return NextResponse.json({ error: 'MFA code is required.' }, { status: 400 });

  const current = await prisma.user.findUnique({ where: { id: user.id } });
  const secret = current && (current as { mfaSecret?: string | null }).mfaSecret;
  if (!current || !secret) {
    return NextResponse.json({ error: 'MFA setup has not been started.' }, { status: 400 });
  }
  if (!verifyTotpCode(secret, code)) {
    return NextResponse.json({ error: 'Invalid MFA code.' }, { status: 401 });
  }
  const backupCodes = generateBackupCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true, mfaRecoveryCodes: backupCodes, mfaVerifiedAt: new Date() },
  });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'auth.mfa.enabled',
    entityType: 'User',
    entityId: user.id,
    route: 'POST /api/auth/mfa/enable',
  });
  return NextResponse.json({ success: true, backupCodes });
}
