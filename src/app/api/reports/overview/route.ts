import { NextRequest, NextResponse } from 'next/server';
import { canViewSystemAnalytics } from '@/lib/staff-permissions';
import { listFeatureFlags } from '@/lib/feature-flags';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { resolveEntityIdOrDefault, jobLocationMatchesEntity } from '@/lib/entity-request';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const APPLICATION_STATUS_META: Array<{ status: string; label: string }> = [
  { status: 'pending', label: 'Pending' },
  { status: 'reviewed', label: 'Reviewed' },
  { status: 'shortlisted', label: 'Shortlisted' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'hired', label: 'Hired' },
];

const INTERVIEW_STATUS_META: Array<{ status: string; label: string }> = [
  { status: 'scheduled', label: 'Scheduled' },
  { status: 'completed', label: 'Completed' },
  { status: 'cancelled', label: 'Cancelled' },
];

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

function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function emptyPayload() {
  return {
    recruitmentAnalytics: {
      totalApplications: 0,
      activeJobs: 0,
      totalJobs: 0,
      totalInterviews: 0,
      scheduledInterviews: 0,
      hired: 0,
      conversionRate: 0,
      requisitionApprovalsPending: 0,
      offerApprovalsPending: 0,
      hiresConverted: 0,
      hireConversionRate: 0,
    },
    applicationsByStatus: APPLICATION_STATUS_META.map((meta) => ({ ...meta, count: 0 })),
    applicationsOverTime: [] as Array<{ month: string; label: string; count: number }>,
    topJobs: [] as Array<{ jobId: string; title: string; company: string; count: number }>,
    interviewsByStatus: INTERVIEW_STATUS_META.map((meta) => ({ ...meta, count: 0 })),
    operations: {
      employees: 0,
      departments: 0,
      credentials: 0,
      expiringCredentials: 0,
      attendanceRecordsThisMonth: 0,
      payrollRunsThisMonth: 0,
      payrollRunsTotal: 0,
    },
    leave: { pending: 0, approved: 0 },
    finance: { invoicesOutstanding: 0, vendors: 0, vendorBillsOutstanding: 0 },
    governance: { activeUsers: 0, essUsers: 0, auditEvents: 0 },
    featureFlags: listFeatureFlags(),
  };
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canViewSystemAnalytics(ctx.staff.role, ctx.staff.staffUserType)) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(emptyPayload());
    }

    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const monthStart = firstDayOfMonth(now);
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const expiringThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const workspaceClientId = await ctx.run((tx) =>
        resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
      );
      const entityId = await resolveEntityIdOrDefault(request);
      const jobGeoFilter = jobLocationMatchesEntity(entityId);
      const applicationJobFilter = jobGeoFilter ? { job: jobGeoFilter } : {};
      const employeeWhere = {
        outsourcingClientId: workspaceClientId,
        client: { organizationId: ctx.organizationId },
      };

      const accountsRow = await ctx.run((tx) =>
        tx.accountsClient.findFirst({
          where: { ...ctx.where(), outsourcingClientId: workspaceClientId },
          select: { id: true },
        }),
      );
      const financeClientId = accountsRow?.id ?? null;

      const [
        applicationsByStatusRaw,
        interviewsByStatusRaw,
        topJobsRaw,
        applicationDates,
        activeJobs,
        totalJobs,
        requisitionApprovalsPending,
        offerApprovalsPending,
        hiresConverted,
        employees,
        departments,
        credentials,
        expiringCredentials,
        attendanceRecordsThisMonth,
        payrollRunsThisMonth,
        payrollRunsTotal,
        pendingLeave,
        approvedLeave,
        invoicesOutstanding,
        vendors,
        vendorBillsOutstanding,
        activeUsers,
        essUsers,
        auditEvents,
      ] = await ctx.run((tx) =>
        Promise.all([
          tx.application.groupBy({
            by: ['status'],
            where: { ...ctx.where(), ...applicationJobFilter },
            _count: { id: true },
          }),
          tx.interview.groupBy({
            by: ['status'],
            where: { ...ctx.where(), ...(jobGeoFilter ? { application: { job: jobGeoFilter } } : {}) },
            _count: { id: true },
          }),
          tx.application.groupBy({
            by: ['jobId'],
            where: { ...ctx.where(), ...applicationJobFilter },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10,
          }),
          tx.application.findMany({
            where: { ...ctx.where(), ...applicationJobFilter, appliedDate: { gte: twelveMonthsAgo } },
            select: { appliedDate: true },
          }),
          safeCount(() => tx.job.count({ where: { ...ctx.where(), ...(jobGeoFilter ?? {}), isActive: true } })),
          safeCount(() => tx.job.count({ where: { ...ctx.where(), ...(jobGeoFilter ?? {}) } })),
          safeCount(() =>
            tx.jobRequisitionApproval.count({
              where: { ...ctx.where(), status: 'pending', job: jobGeoFilter ?? undefined },
            }),
          ),
          safeCount(() =>
            tx.jobOfferApproval.count({
              where: { ...ctx.where(), status: 'pending', application: { job: jobGeoFilter ?? undefined } },
            }),
          ),
          safeCount(() =>
            tx.applicationHireConversion.count({
              where: { ...ctx.where(), application: { job: jobGeoFilter ?? undefined } },
            }),
          ),
          safeCount(() => tx.employee.count({ where: employeeWhere })),
          safeCount(() =>
            tx.department.count({ where: { ...ctx.where(), outsourcingClientId: workspaceClientId } }),
          ),
          safeCount(() => tx.employeeCredential.count({ where: { ...ctx.where(), employee: employeeWhere } })),
          safeCount(() =>
            tx.employeeCredential.count({
              where: { ...ctx.where(), employee: employeeWhere, expiryDate: { gte: now, lte: expiringThreshold } },
            }),
          ),
          safeCount(() =>
            tx.attendance.count({ where: { ...ctx.where(), date: { gte: monthStart }, employee: employeeWhere } }),
          ),
          safeCount(() => tx.payroll.count({ where: { ...ctx.where(), month, year, employee: employeeWhere } })),
          safeCount(() => tx.payroll.count({ where: { ...ctx.where(), employee: employeeWhere } })),
          safeCount(() =>
            tx.leaveApplication.count({ where: { ...ctx.where(), status: 'pending', employee: employeeWhere } }),
          ),
          safeCount(() =>
            tx.leaveApplication.count({ where: { ...ctx.where(), status: 'approved', employee: employeeWhere } }),
          ),
          safeCount(() =>
            financeClientId
              ? tx.accountsInvoice.count({
                  where: { ...ctx.where(), clientId: financeClientId, status: { in: ['unpaid', 'partial'] } },
                })
              : Promise.resolve(0),
          ),
          safeCount(() => tx.accountsVendor.count({ where: ctx.where() })),
          safeCount(() =>
            tx.accountsVendorBill.count({ where: { ...ctx.where(), status: { in: ['unpaid', 'partial'] } } }),
          ),
          safeCount(() => tx.user.count({ where: { isActive: true } })),
          safeCount(() => tx.essPortalUser.count({ where: { ...ctx.where(), employee: employeeWhere } })),
          safeCount(() => tx.auditEvent.count({ where: ctx.where() })),
        ]),
      );

      const statusCountMap = new Map<string, number>(
        applicationsByStatusRaw.map((row) => [String(row.status), row._count.id]),
      );
      const applicationsByStatus = APPLICATION_STATUS_META.map((meta) => ({
        ...meta,
        count: statusCountMap.get(meta.status) ?? 0,
      }));
      const totalApplications = applicationsByStatusRaw.reduce((sum, row) => sum + row._count.id, 0);
      const hired = statusCountMap.get('hired') ?? 0;

      const interviewCountMap = new Map<string, number>(
        interviewsByStatusRaw.map((row) => [String(row.status), row._count.id]),
      );
      const interviewsByStatus = INTERVIEW_STATUS_META.map((meta) => ({
        ...meta,
        count: interviewCountMap.get(meta.status) ?? 0,
      }));
      const totalInterviews = interviewsByStatusRaw.reduce((sum, row) => sum + row._count.id, 0);
      const scheduledInterviews = interviewCountMap.get('scheduled') ?? 0;

      const topJobIds = topJobsRaw.map((row) => row.jobId);
      const topJobRecords =
        topJobIds.length > 0
          ? await ctx.run((tx) =>
              tx.job.findMany({
                where: { ...ctx.where(), id: { in: topJobIds } },
                select: { id: true, title: true, company: true },
              }),
            )
          : [];
      const jobMetaMap = new Map(topJobRecords.map((job) => [job.id, job]));
      const topJobs = topJobsRaw
        .map((row) => {
          const meta = jobMetaMap.get(row.jobId);
          return {
            jobId: row.jobId,
            title: meta?.title ?? 'Unknown job',
            company: meta?.company ?? '',
            count: row._count.id,
          };
        })
        .filter((job) => job.count > 0);

      const monthBuckets = new Map<string, number>();
      for (let i = 11; i >= 0; i -= 1) {
        const bucket = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthBuckets.set(monthKey(bucket), 0);
      }
      for (const row of applicationDates) {
        const key = monthKey(new Date(row.appliedDate));
        if (monthBuckets.has(key)) monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + 1);
      }
      const applicationsOverTime = Array.from(monthBuckets.entries()).map(([key, count]) => ({
        month: key,
        label: monthLabel(key),
        count,
      }));

      const conversionRate = totalApplications > 0 ? Number(((hired / totalApplications) * 100).toFixed(1)) : 0;
      const hireConversionRate =
        totalApplications > 0 ? Number(((hiresConverted / totalApplications) * 100).toFixed(1)) : 0;

      return NextResponse.json({
        recruitmentAnalytics: {
          totalApplications,
          activeJobs,
          totalJobs,
          totalInterviews,
          scheduledInterviews,
          hired,
          conversionRate,
          requisitionApprovalsPending,
          offerApprovalsPending,
          hiresConverted,
          hireConversionRate,
        },
        applicationsByStatus,
        applicationsOverTime,
        topJobs,
        interviewsByStatus,
        operations: {
          employees,
          departments,
          credentials,
          expiringCredentials,
          attendanceRecordsThisMonth,
          payrollRunsThisMonth,
          payrollRunsTotal,
        },
        leave: {
          pending: pendingLeave,
          approved: approvedLeave,
        },
        finance: {
          invoicesOutstanding,
          vendors,
          vendorBillsOutstanding,
        },
        governance: {
          activeUsers,
          essUsers,
          auditEvents,
        },
        featureFlags: listFeatureFlags(),
      });
    } catch (error) {
      console.error('GET /api/reports/overview error:', error);
      return NextResponse.json({ error: 'Failed to load reports overview.' }, { status: 500 });
    }
  });
}
