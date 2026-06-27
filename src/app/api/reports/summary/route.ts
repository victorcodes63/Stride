import { NextRequest, NextResponse } from 'next/server';
import { assertReportsStaffRole } from '@/app/api/reports/_shared';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

function isMissingTableError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2021';
}

async function safeCount(query: () => Promise<number>): Promise<number> {
  try {
    return await query();
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const denied = assertReportsStaffRole(ctx.staff);
    if (denied) return denied;
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const expiringThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const workspaceClientId = await ctx.run((tx) =>
        resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
      );

      const employeeWhere = {
        outsourcingClientId: workspaceClientId,
        client: { organizationId: ctx.organizationId },
      };

      const [
        employees,
        departments,
        newHires30d,
        terminations30d,
        credentials,
        expiringCredentials30,
        expiredCredentials,
        attendanceSummariesMonth,
        openAttendanceExceptions,
        pendingLeave,
        approvedLeaveMonth,
        payrollRunsMonth,
        payrollRunsTotal,
        openDisciplinaryCases,
        openGrievances,
        activeOnboarding,
        activeJobs,
        totalApplications,
        pendingApplications,
        upcomingInterviews,
        essUsers,
        auditEvents30d,
        invoicesOutstanding,
        vendorBillsOutstanding,
      ] = await ctx.run((tx) =>
        Promise.all([
          safeCount(() =>
            tx.employee.count({ where: { ...employeeWhere, employmentStatus: { not: 'terminated' } } }),
          ),
          safeCount(() =>
            tx.department.count({ where: { ...ctx.where(), outsourcingClientId: workspaceClientId } }),
          ),
          safeCount(() =>
            tx.employee.count({
              where: { ...employeeWhere, createdAt: { gte: thirtyDaysAgo } },
            }),
          ),
          safeCount(() =>
            tx.employee.count({
              where: { ...employeeWhere, employmentEndedAt: { gte: thirtyDaysAgo } },
            }),
          ),
          safeCount(() =>
            tx.employeeCredential.count({ where: { ...ctx.where(), employee: employeeWhere } }),
          ),
          safeCount(() =>
            tx.employeeCredential.count({
              where: {
                ...ctx.where(),
                employee: employeeWhere,
                expiryDate: { gte: now, lte: expiringThreshold },
              },
            }),
          ),
          safeCount(() =>
            tx.employeeCredential.count({
              where: { ...ctx.where(), employee: employeeWhere, expiryDate: { lt: now } },
            }),
          ),
          safeCount(() =>
            tx.attendanceDaySummary.count({
              where: { ...ctx.where(), outsourcingClientId: workspaceClientId, workDate: { gte: monthStart } },
            }),
          ),
          safeCount(() =>
            tx.attendanceException.count({
              where: { ...ctx.where(), employee: employeeWhere, status: 'open' },
            }),
          ),
          safeCount(() =>
            tx.leaveApplication.count({ where: { ...ctx.where(), status: 'pending', employee: employeeWhere } }),
          ),
          safeCount(() =>
            tx.leaveApplication.count({
              where: { ...ctx.where(), status: 'approved', employee: employeeWhere, updatedAt: { gte: monthStart } },
            }),
          ),
          safeCount(() =>
            tx.payroll.count({
              where: {
                ...ctx.where(),
                month: now.getMonth() + 1,
                year: now.getFullYear(),
                employee: employeeWhere,
              },
            }),
          ),
          safeCount(() => tx.payroll.count({ where: { ...ctx.where(), employee: employeeWhere } })),
          safeCount(() =>
            tx.disciplinaryCase.count({
              where: {
                ...ctx.where(),
                employee: employeeWhere,
                status: { in: ['OPEN', 'UNDER_INVESTIGATION', 'HEARING_SCHEDULED', 'AWAITING_RESPONSE', 'ESCALATED'] },
              },
            }),
          ),
          safeCount(() =>
            tx.grievance.count({
              where: {
                ...ctx.where(),
                employee: employeeWhere,
                status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATING', 'ESCALATED'] },
              },
            }),
          ),
          safeCount(() =>
            tx.onboardingWorkflow.count({
              where: { ...ctx.where(), employee: employeeWhere, status: 'IN_PROGRESS' },
            }),
          ),
          safeCount(() => tx.job.count({ where: { ...ctx.where(), isActive: true } })),
          safeCount(() => tx.application.count({ where: ctx.where() })),
          safeCount(() => tx.application.count({ where: { ...ctx.where(), status: 'pending' } })),
          safeCount(() =>
            tx.interview.count({
              where: { ...ctx.where(), scheduledAt: { gte: now } },
            }),
          ),
          safeCount(() => tx.essPortalUser.count({ where: { ...ctx.where(), employee: employeeWhere } })),
          safeCount(() => tx.auditEvent.count({ where: { ...ctx.where(), createdAt: { gte: thirtyDaysAgo } } })),
          safeCount(() =>
            tx.accountsInvoice.count({ where: { ...ctx.where(), status: { in: ['unpaid', 'partial'] } } }),
          ),
          safeCount(() =>
            tx.accountsVendorBill.count({ where: { ...ctx.where(), status: { in: ['unpaid', 'partial'] } } }),
          ),
        ]),
      );

      return NextResponse.json({
        generatedAt: now.toISOString(),
        people: { employees, departments, newHires30d, terminations30d },
        credentials: { total: credentials, expiring30: expiringCredentials30, expired: expiredCredentials },
        time: {
          attendanceSummariesMonth,
          openAttendanceExceptions,
          pendingLeave,
          approvedLeaveMonth,
        },
        payroll: { runsThisMonth: payrollRunsMonth, runsTotal: payrollRunsTotal },
        compliance: {
          openDisciplinaryCases,
          openGrievances,
          activeOnboarding,
        },
        recruitment: {
          activeJobs,
          totalApplications,
          pendingApplications,
          upcomingInterviews,
        },
        governance: { essUsers, auditEvents30d },
        finance: { invoicesOutstanding, vendorBillsOutstanding },
      });
    } catch (error) {
      console.error('GET /api/reports/summary error:', error);
      return NextResponse.json({ error: 'Failed to load reports summary.' }, { status: 500 });
    }
  });
}
