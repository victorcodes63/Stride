import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { getHrUserIds, sendNotification } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ bank: null });

  const emp = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: { bankName: true, bankBranch: true, bankAccountNumber: true },
  });

  const mask = (v: string | null) => {
    if (!v || v.length < 4) return v ? '****' : null;
    return `****${v.slice(-4)}`;
  };

  return NextResponse.json({
    bank: emp
      ? {
          bankName: emp.bankName,
          bankBranch: emp.bankBranch,
          bankAccountNumber: mask(emp.bankAccountNumber),
        }
      : null,
  });
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const bankName = typeof b.bankName === 'string' ? b.bankName.trim() : '';
  const bankBranch = typeof b.bankBranch === 'string' ? b.bankBranch.trim() : '';
  const bankAccountNumber = typeof b.bankAccountNumber === 'string' ? b.bankAccountNumber.trim() : '';
  const reason = typeof b.reason === 'string' ? b.reason.trim() : '';

  if (!bankName || !bankAccountNumber) {
    return NextResponse.json({ error: 'Bank name and account number are required.' }, { status: 400 });
  }

  const hrUserIds = await getHrUserIds();
  await sendNotification({
    event: 'profile_change_requested',
    recipientUserIds: hrUserIds,
    title: 'Bank details change request',
    body: `${user.name} requested an update to bank details.${reason ? ` Note: ${reason}` : ''}`,
    href: '/dashboard/employees',
    priority: 'action_required',
    channel: 'in_app',
    metadata: {
      employeeId: user.employeeId,
      bankName,
      bankBranch,
      accountLast4: bankAccountNumber.slice(-4),
    },
  });

  return NextResponse.json({ status: 'submitted', message: 'HR will review your bank detail change request.' });
}
