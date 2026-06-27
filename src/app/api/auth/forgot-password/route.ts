import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const email = typeof (body as Record<string, unknown>).email === 'string'
    ? (body as Record<string, unknown>).email.trim().toLowerCase()
    : '';

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  // Always return success to avoid email enumeration
  const generic = { success: true, message: 'If an account exists, reset instructions have been sent.' };

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, isActive: true } });
    if (!user?.isActive) return NextResponse.json(generic);

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name ?? '',
      portal: 'staff',
      userId: user.id,
    });
  } catch (err) {
    console.error('[auth/forgot-password]', err);
  }

  return NextResponse.json(generic);
}
