import { NextRequest, NextResponse } from 'next/server';
import { getHrUserIds, sendNotification } from '@/lib/notifications';
import { logSensitiveFieldAccess } from '@/lib/sensitive-access-log';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ bank: null });

    const emp = await ctx.run((tx) =>
      tx.employee.findFirst({
        where: ctx.where({ id: ctx.employeeId! }),
        select: { bankName: true, bankBranch: true, bankAccountNumber: true },
      }),
    );

    await logSensitiveFieldAccess({
      actor: { userId: ctx.essUser.id, email: ctx.essUser.email, name: ctx.essUser.name },
      fieldGroup: 'bank_details',
      entityType: 'Employee',
      entityId: ctx.employeeId,
      route: 'GET /api/ess/pay/bank-change',
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
  });
}

export async function POST(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) {
      return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });
    }

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
      body: `${ctx.essUser.name} requested an update to bank details.${reason ? ` Note: ${reason}` : ''}`,
      href: '/dashboard/employees',
      priority: 'action_required',
      channel: 'in_app',
      metadata: {
        employeeId: ctx.employeeId,
        bankName,
        bankBranch,
        accountLast4: bankAccountNumber.slice(-4),
      },
    });

    return NextResponse.json({
      status: 'submitted',
      message: 'HR will review your bank detail change request.',
    });
  });
}
