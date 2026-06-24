import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPayslipEmail } from '@/lib/email';
import { normalizeAttendance } from '@/lib/biweekly-attendance';
import { isBiweeklyClient } from '@/lib/biweekly-payroll';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessPayroll, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { logAuditEvent } from '@/lib/audit-events';
import { getEssPortalUserIdForEmployee, sendNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!canAccessPayroll(user)) {
      return forbiddenResponse('Payroll access is restricted to finance and admins.');
    }
    const body = await request.json().catch(() => ({}));
    const month = body.month != null ? parseInt(String(body.month), 10) : new Date().getMonth() + 1;
    const year = body.year != null ? parseInt(String(body.year), 10) : new Date().getFullYear();
    const requestedClientId = typeof body.clientId === 'string' ? body.clientId : undefined;
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
    const departmentId = typeof body.departmentId === 'string' ? body.departmentId : undefined;
    const testTo = typeof body.testTo === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.testTo) ? body.testTo : undefined;
    const employeeIds = Array.isArray(body.employeeIds)
      ? (body.employeeIds as string[]).filter((id): id is string => typeof id === 'string')
      : undefined;

    if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year)) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
    }

    const payrolls = await prisma.payroll.findMany({
      where: {
        month,
        year,
        ...(employeeIds?.length
          ? { employeeId: { in: employeeIds } }
          : {
              employee: {
                outsourcingClientId: clientId,
                ...(departmentId ? { departmentId } : {}),
              },
            }),
      },
      include: {
        employee: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            client: { select: { name: true, payrollFrequency: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
    });

    const sent: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];
    let diagnostics: Record<string, unknown> | undefined;

    const toProcess = testTo ? payrolls.slice(0, 1) : payrolls;
    for (const p of toProcess) {
      const email = testTo || p.employee.email?.trim();
      const employeeName = `${p.employee.firstName} ${p.employee.lastName}`;
      if (!email) {
        skipped.push(employeeName);
        continue;
      }
      const biweekly =
        isBiweeklyClient(p.employee.client.payrollFrequency) &&
        p.period1Gross != null &&
        p.period2Gross != null;
      const result = await sendPayslipEmail({
        to: email,
        employeeName,
        month,
        year,
        data: {
          employeeName,
          employeeNumber: p.employee.employeeNumber,
          clientName: p.employee.client.name,
          departmentName: p.employee.department?.name ?? null,
          basicPay: String(p.basicPay),
          allowances: (p.allowances as { name: string; amount: number }[]) ?? [],
          deductions: (p.deductions as { name: string; amount: number }[]) ?? [],
          grossPay: String(p.grossPay),
          leavePay: String(p.leavePay ?? 0),
          paye: String(p.paye),
          nssf: String(p.nssf),
          nhif: String(p.nhif),
          ahl: String(p.ahl ?? 0),
          employerNita: String(p.nita ?? 0),
          netPay: String(p.netPay),
          ...(biweekly
            ? {
                biweekly: true,
                period1Gross: String(p.period1Gross),
                period2Gross: String(p.period2Gross),
                biweeklyAttendance: normalizeAttendance(p.biweeklyAttendance, year, month),
              }
            : {}),
        },
      });
      if (result.sent) {
        sent.push(employeeName);
        try {
          const essId = await getEssPortalUserIdForEmployee(p.employee.id);
          if (essId) {
            await sendNotification({
              event: 'payslip_ready',
              recipientEssPortalUserIds: [essId],
              title: 'Payslip available',
              body: `Your payslip for ${month}/${year} is now available.`,
              href: '/ess/payslips',
              priority: 'info',
              channel: 'both',
              metadata: { period: `${month}/${year}` },
            });
          }
        } catch (err) {
          console.error('[notifications] Failed to send payslip_ready:', err);
        }
      } else {
        errors.push(`${employeeName}: ${result.error || 'Failed to send'}`);
        if (result.diagnostics && !diagnostics) {
          diagnostics = result.diagnostics;
        }
      }
    }

    const payload: {
      sent: number;
      skipped: number;
      errors?: string[];
      details: { sent: string[]; skipped: string[]; errors: string[] };
      diagnostics?: typeof diagnostics;
    } = {
      sent: sent.length,
      skipped: skipped.length,
      details: { sent, skipped, errors },
    };
    if (errors.length > 0) payload.errors = errors;
    if (diagnostics) payload.diagnostics = diagnostics;
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'payslip.sent',
      entityType: 'PayrollBatch',
      entityId: `${year}-${month}-${clientId}`,
      route: 'POST /api/outsourcing/payroll/send-payslips',
      metadata: {
        month,
        year,
        clientId,
        departmentId: departmentId ?? null,
        sent: sent.length,
        skipped: skipped.length,
        errors: errors.length,
        testMode: Boolean(testTo),
      },
    });
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[send-payslips]', msg, stack);
    return NextResponse.json(
      { error: 'Failed to send payslips', details: process.env.NODE_ENV === 'development' ? msg : undefined },
      { status: 500 }
    );
  }
}
