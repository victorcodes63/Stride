import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStaffSessionMaxAgeSeconds, parseStaffSession } from '@/lib/auth-session';
import { userRowToSummary } from '@/lib/user-summary-api';
import { reportApiError } from '@/lib/monitoring';

const STAFF_SESSION_COOKIE = 'staff_session';
const STAFF_SESSION_MAX_AGE = getStaffSessionMaxAgeSeconds();

export async function GET(request: NextRequest) {
  const rawSession = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  if (!rawSession) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const parsed = parseStaffSession(rawSession);
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    let user = null as Awaited<ReturnType<typeof prisma.user.findUnique>> | null;
    if (parsed.userId) {
      user = await prisma.user.findUnique({ where: { id: parsed.userId } });
    }
    if (!user && parsed.email) {
      user = await prisma.user.findUnique({ where: { email: parsed.email.toLowerCase() } });
    }
    if (!user) {
      const response = NextResponse.json({ error: 'User not found.' }, { status: 401 });
      response.cookies.set(STAFF_SESSION_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });
      return response;
    }
    if (!user.isActive) {
      const response = NextResponse.json({ error: 'User is inactive.' }, { status: 403 });
      response.cookies.set(STAFF_SESSION_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
      });
      return response;
    }
    const response = NextResponse.json(await userRowToSummary(user));
    // Rolling session refresh on activity.
    response.cookies.set(STAFF_SESSION_COOKIE, rawSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: STAFF_SESSION_MAX_AGE,
      path: '/',
    });
    return response;
  } catch (error) {
    await reportApiError({
      route: 'GET /api/auth/me',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load current user.' }, { status: 500 });
  }
}
