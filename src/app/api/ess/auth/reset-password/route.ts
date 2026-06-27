import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { verifyAccountLinkToken } from '@/lib/account-link-token';
import { sendNotification } from '@/lib/notifications';

const ROUNDS = 10;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const token = typeof b.token === 'string' ? b.token : '';
  const password = typeof b.password === 'string' ? b.password : '';

  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: 'Valid token and password (min 6 characters) are required.' }, { status: 400 });
  }

  const payload =
    verifyAccountLinkToken(token, 'ess_reset_password') ||
    verifyAccountLinkToken(token, 'ess_set_password');
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired link. Contact HR for a new invite.' }, { status: 400 });
  }

  const user = await prisma.essPortalUser.findUnique({ where: { id: payload.userId } });
  if (!user || user.email !== payload.email || !user.isActive) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(password, ROUNDS);
  await prisma.essPortalUser.update({
    where: { id: user.id },
    data: { passwordHash, mustResetPassword: false },
  });

  try {
    await sendNotification({
      event: 'password_changed',
      recipientEssPortalUserIds: [user.id],
      title: 'Password changed',
      body: 'Your ESS password was updated successfully.',
      priority: 'info',
      channel: 'email',
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch {
    // non-blocking
  }

  return NextResponse.json({ success: true });
}
