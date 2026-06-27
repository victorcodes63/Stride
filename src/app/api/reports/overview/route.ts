import { NextRequest, NextResponse } from 'next/server';
import { canViewSystemAnalytics } from '@/lib/staff-permissions';
import { listFeatureFlags } from '@/lib/feature-flags';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { resolveEntityIdOrDefault, jobLocationMatchesEntity } from '@/lib/entity-request';
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

function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canViewSystemAnalytics(ctx.staff.role, ctx.staff.staffUserType)) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        recruitment: { jobs: [], applications: [], interviews: [] },
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
      });
    }

    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const monthStart = firstDayOfMonth(now);
      const expiringThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const workspaceClientId = await ctx.run((tx) =>
        resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
      );
      const entityId = await resolveEntityIdOrDefault(request);
      const jobGeoFilter = jobLocationMatchesEntity(entityId);
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
        jobs,
        applications,
        interviews,
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
          tx.job.findMany({
            where: { ...ctx.where(), ...(jobGeoFilter ?? {}) },
            select: {
              id: true,
              title: true,
              company: true,
              isActive: true,
              applicationCount: true,
            },
          }),
          tx.application.findMany({
            where: { ...ctx.where(), ...(jobGeoFilter ? { job: jobGeoFilter } : {}) },
            select: {
              id: true,
              jobId: true,
              status: true,
              appliedDate: true,
              job: { select: { id: true, title: true, company: true } },
              candidate: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  location: true,
                  nationality: true,
                  homeCounty: true,
                  experience: true,
                  education: true,
                  resumePath: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
              notes: true,
              coverLetter: true,
              resumePath: true,
              salaryExpectations: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
          tx.interview.findMany({
            where: { ...ctx.where(), ...(jobGeoFilter ? { application: { job: jobGeoFilter } } : {}) },
            include: {
              application: {
                include: {
                  candidate: true,
                  job: true,
                },
              },
            },
          }),
          safeCount(() =>
            tx.jobRequisitionApproval.count({
              where: {
                ...ctx.where(),
                status: 'pending',
                job: jobGeoFilter ?? undefined,
              },
            }),
          ),
          safeCount(() =>
            tx.jobOfferApproval.count({
              where: {
                ...ctx.where(),
                status: 'pending',
                application: {
                  job: jobGeoFilter ?? undefined,
                },
              },
            }),
          ),
          safeCount(() =>
            tx.applicationHireConversion.count({
              where: {
                ...ctx.where(),
                application: {
                  job: jobGeoFilter ?? undefined,
                },
              },
            }),
          ),
          safeCount(() =>
            tx.employee.count({
              where: employeeWhere,
            }),
          ),
          safeCount(() =>
            tx.department.count({
              where: { ...ctx.where(), outsourcingClientId: workspaceClientId },
            }),
          ),
          safeCount(() =>
            tx.employeeCredential.count({
              where: { ...ctx.where(), employee: employeeWhere },
            }),
          ),
          safeCount(() =>
            tx.employeeCredential.count({
              where: {
                ...ctx.where(),
                employee: employeeWhere,
                expiryDate: {
                  gte: now,
                  lte: expiringThreshold,
                },
              },
            }),
          ),
          safeCount(() =>
            tx.attendance.count({
              where: {
                ...ctx.where(),
                date: { gte: monthStart },
                employee: employeeWhere,
              },
            }),
          ),
          safeCount(() =>
            tx.payroll.count({
              where: { ...ctx.where(), month, year, employee: employeeWhere },
            }),
          ),
          safeCount(() =>
            tx.payroll.count({
              where: { ...ctx.where(), employee: employeeWhere },
            }),
          ),
          safeCount(() =>
            tx.leaveApplication.count({
              where: { ...ctx.where(), status: 'pending', employee: employeeWhere },
            }),
          ),
          safeCount(() =>
            tx.leaveApplication.count({
              where: { ...ctx.where(), status: 'approved', employee: employeeWhere },
            }),
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
            tx.accountsVendorBill.count({
              where: { ...ctx.where(), status: { in: ['unpaid', 'partial'] } },
            }),
          ),
          safeCount(() =>
            tx.user.count({
              where: { isActive: true },
            }),
          ),
          safeCount(() =>
            tx.essPortalUser.count({
              where: { ...ctx.where(), employee: employeeWhere },
            }),
          ),
          safeCount(() => tx.auditEvent.count({ where: ctx.where() })),
        ]),
      );

      return NextResponse.json({
        recruitment: { jobs, applications, interviews },
        recruitmentAnalytics: {
          requisitionApprovalsPending,
          offerApprovalsPending,
          hiresConverted,
          hireConversionRate:
            applications.length > 0
              ? Number(((hiresConverted / applications.length) * 100).toFixed(2))
              : 0,
        },
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
