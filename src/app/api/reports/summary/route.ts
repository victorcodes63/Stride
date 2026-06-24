import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireReportsUser } from '@/app/api/reports/_shared';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

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
  const auth = await requireReportsUser(request);
  if (!auth.ok) return auth.response;
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const expiringThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

    const employeeWhere = { outsourcingClientId: workspaceClientId };

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
    ] = await Promise.all([
      safeCount(() => prisma.employee.count({ where: { ...employeeWhere, employmentStatus: { not: 'terminated' } } })),
      safeCount(() => prisma.department.count({ where: { outsourcingClientId: workspaceClientId } })),
      safeCount(() =>
        prisma.employee.count({
          where: { ...employeeWhere, createdAt: { gte: thirtyDaysAgo } },
        }),
      ),
      safeCount(() =>
        prisma.employee.count({
          where: { ...employeeWhere, employmentEndedAt: { gte: thirtyDaysAgo } },
        }),
      ),
      safeCount(() => prisma.employeeCredential.count({ where: { employee: employeeWhere } })),
      safeCount(() =>
        prisma.employeeCredential.count({
          where: {
            employee: employeeWhere,
            expiryDate: { gte: now, lte: expiringThreshold },
          },
        }),
      ),
      safeCount(() =>
        prisma.employeeCredential.count({
          where: { employee: employeeWhere, expiryDate: { lt: now } },
        }),
      ),
      safeCount(() =>
        prisma.attendanceDaySummary.count({
          where: { outsourcingClientId: workspaceClientId, workDate: { gte: monthStart } },
        }),
      ),
      safeCount(() =>
        prisma.attendanceException.count({
          where: { employee: employeeWhere, status: 'open' },
        }),
      ),
      safeCount(() => prisma.leaveApplication.count({ where: { status: 'pending', employee: employeeWhere } })),
      safeCount(() =>
        prisma.leaveApplication.count({
          where: { status: 'approved', employee: employeeWhere, updatedAt: { gte: monthStart } },
        }),
      ),
      safeCount(() =>
        prisma.payroll.count({
          where: { month: now.getMonth() + 1, year: now.getFullYear(), employee: employeeWhere },
        }),
      ),
      safeCount(() => prisma.payroll.count({ where: { employee: employeeWhere } })),
      safeCount(() =>
        prisma.disciplinaryCase.count({
          where: {
            employee: employeeWhere,
            status: { in: ['OPEN', 'UNDER_INVESTIGATION', 'HEARING_SCHEDULED', 'AWAITING_RESPONSE', 'ESCALATED'] },
          },
        }),
      ),
      safeCount(() =>
        prisma.grievance.count({
          where: {
            employee: employeeWhere,
            status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATING', 'ESCALATED'] },
          },
        }),
      ),
      safeCount(() =>
        prisma.onboardingWorkflow.count({
          where: { employee: employeeWhere, status: 'IN_PROGRESS' },
        }),
      ),
      safeCount(() => prisma.job.count({ where: { isActive: true } })),
      safeCount(() => prisma.application.count()),
      safeCount(() => prisma.application.count({ where: { status: 'pending' } })),
      safeCount(() =>
        prisma.interview.count({
          where: { scheduledAt: { gte: now } },
        }),
      ),
      safeCount(() => prisma.essPortalUser.count({ where: { employee: employeeWhere } })),
      safeCount(() => prisma.auditEvent.count({ where: { createdAt: { gte: thirtyDaysAgo } } })),
      safeCount(() => prisma.accountsInvoice.count({ where: { status: { in: ['unpaid', 'partial'] } } })),
      safeCount(() => prisma.accountsVendorBill.count({ where: { status: { in: ['unpaid', 'partial'] } } })),
    ]);

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
}
