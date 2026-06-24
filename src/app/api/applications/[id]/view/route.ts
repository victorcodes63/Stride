import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseStaffSession } from '@/lib/auth-session';

const STAFF_SESSION_COOKIE = 'staff_session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params;
  if (!applicationId) {
    return NextResponse.json({ error: 'Application id required' }, { status: 400 });
  }

  const rawSession = request.cookies.get(STAFF_SESSION_COOKIE)?.value;
  if (!rawSession) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const parsed = parseStaffSession(rawSession);
  const userId = parsed.userId;

  if (!userId || !process.env.DATABASE_URL) {
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.applicationView.upsert({
      where: { applicationId_userId: { applicationId, userId } },
      create: { applicationId, userId },
      update: { viewedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
