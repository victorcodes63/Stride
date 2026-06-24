import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { logAuditEvent } from '@/lib/audit-events';
import { sendNotification } from '@/lib/notifications';

const ROUNDS = 10;

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const currentPassword = typeof b.currentPassword === 'string' ? b.currentPassword : '';
  const newPassword = typeof b.newPassword === 'string' ? b.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password are required.' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
  }

  const current = await prisma.essPortalUser.findUnique({ where: { id: user.id } });
  if (!current) return NextResponse.json({ error: 'ESS user not found.' }, { status: 404 });

  const ok = await bcrypt.compare(currentPassword, current.passwordHash);
  if (!ok) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });

  await prisma.essPortalUser.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, ROUNDS),
      mustResetPassword: false,
    },
  });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'ess.password.changed',
    entityType: 'EssPortalUser',
    entityId: user.id,
    route: 'POST /api/ess/auth/password',
    metadata: { mustResetPassword: false },
  });
  try {
    await sendNotification({
      event: 'password_changed',
      recipientEssPortalUserIds: [user.id],
      title: 'Password changed',
      body: "Your password was changed. If you didn't do this, contact your administrator immediately.",
      href: '/ess/account-security',
      priority: 'urgent',
      channel: 'both',
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[notifications] Failed to send password_changed:', err);
  }

  return NextResponse.json({ success: true });
}
