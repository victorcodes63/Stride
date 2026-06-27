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
    verifyAccountLinkToken(token, 'staff_reset_password') ||
    verifyAccountLinkToken(token, 'staff_set_password');
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired link. Request a new reset email.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.email !== payload.email || !user.isActive) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(password, ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  try {
    await sendNotification({
      event: 'password_changed',
      recipientUserIds: [user.id],
      title: 'Password changed',
      body: 'Your password was updated successfully.',
      priority: 'info',
      channel: 'email',
      metadata: { timestamp: new Date().toISOString() },
    });
  } catch {
    // non-blocking
  }

  return NextResponse.json({ success: true });
}
