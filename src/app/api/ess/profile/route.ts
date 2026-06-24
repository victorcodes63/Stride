import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { getHrUserIds, sendNotification } from '@/lib/notifications';

export async function PATCH(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: 'No linked employee profile.' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const phone = typeof b.phone === 'string' ? b.phone.trim() : null;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : null;
  if (email && !/\S+@\S+\.\S+/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const updated = await prisma.employee.update({
    where: { id: user.employeeId },
    data: {
      phone: phone || null,
      email: email || null,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      updatedAt: true,
    },
  });
  try {
    const hrUserIds = await getHrUserIds();
    await sendNotification({
      event: 'profile_change_requested',
      recipientUserIds: hrUserIds,
      title: 'Profile update request',
      body: `${user.name || user.email} has requested changes to their profile. Please review.`,
      href: '/dashboard/outsourcing/employees',
      priority: 'action_required',
      channel: 'in_app',
      metadata: {
        employeeId: user.employeeId,
        email: updated.email,
        phone: updated.phone,
      },
    });
  } catch (err) {
    console.error('[notifications] Failed to send profile_change_requested:', err);
  }

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    phone: updated.phone,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
