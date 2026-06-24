import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { buildOtpAuthUri, generateTotpSecret } from '@/lib/mfa-totp';
import { logAuditEvent } from '@/lib/audit-events';
import { brand } from '@/lib/brand';

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: secret, mfaEnabled: false },
  });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'auth.mfa.setup_started',
    entityType: 'User',
    entityId: user.id,
    route: 'POST /api/auth/mfa/setup',
  });
  const issuer = process.env.NEXT_PUBLIC_BRAND_NAME || brand.appName;
  return NextResponse.json({
    secret,
    otpAuthUrl: buildOtpAuthUri(issuer, user.email, secret),
  });
}
