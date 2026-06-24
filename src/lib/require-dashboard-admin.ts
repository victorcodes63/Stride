import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseStaffSession } from '@/lib/auth-session';

/** Ensures the request is from an active internal `User` with role admin. */
export async function requireDashboardAdmin(request: NextRequest): Promise<NextResponse | null> {
  const rawSession = request.cookies.get('staff_session')?.value;
  if (!rawSession) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const parsed = parseStaffSession(rawSession);
  if (!process.env.DATABASE_URL) {
    if (parsed.role === 'admin') return null;
    return NextResponse.json({ error: 'Only admins can perform this action.' }, { status: 403 });
  }

  let currentUser = null as Awaited<ReturnType<typeof prisma.user.findUnique>> | null;
  if (parsed.userId) {
    currentUser = await prisma.user.findUnique({ where: { id: parsed.userId } });
  }
  if (!currentUser && parsed.email) {
    currentUser = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
  }

  if (!currentUser) {
    return NextResponse.json({ error: 'No staff account found for this session.' }, { status: 401 });
  }
  if (!currentUser.isActive) {
    return NextResponse.json({ error: 'Your account is inactive. Contact an administrator.' }, { status: 403 });
  }
  if (currentUser.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can perform this action.' }, { status: 403 });
  }
  return null;
}
