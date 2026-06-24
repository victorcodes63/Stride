import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEssSessionMaxAgeSeconds, parseEssSession } from '@/lib/ess-session';

const ESS_SESSION_COOKIE = 'ess_session';
const ESS_SESSION_MAX_AGE = getEssSessionMaxAgeSeconds();

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(ESS_SESSION_COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const parsed = parseEssSession(raw);
  if (!parsed.userId) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });

  const user = await prisma.essPortalUser.findUnique({
    where: { id: parsed.userId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
          employeeNumber: true,
          employmentStatus: true,
          dateOfJoining: true,
        },
      },
    },
  });

  if (!user || !user.isActive) {
    const res = NextResponse.json({ error: 'Session expired.' }, { status: 401 });
    res.cookies.set(ESS_SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return res;
  }

  const response = NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustResetPassword: user.mustResetPassword,
    employee: user.employee
      ? {
          id: user.employee.id,
          name: `${user.employee.firstName} ${user.employee.lastName}`.trim(),
          email: user.employee.email,
          phone: user.employee.phone,
          jobTitle: user.employee.jobTitle,
          employeeNumber: user.employee.employeeNumber,
          employmentStatus: user.employee.employmentStatus,
          dateOfJoining: user.employee.dateOfJoining?.toISOString() ?? null,
        }
      : null,
  });

  response.cookies.set(ESS_SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ESS_SESSION_MAX_AGE,
    path: '/',
  });
  return response;
}
