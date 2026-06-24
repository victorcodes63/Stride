import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canViewSystemAnalytics } from '@/lib/staff-permissions';
import { listFeatureFlags } from '@/lib/feature-flags';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { resolveEntityIdOrDefault, jobLocationMatchesEntity } from '@/lib/entity-request';

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
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  if (!canViewSystemAnalytics(user.role, user.staffUserType)) {
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

    const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
    const entityId = await resolveEntityIdOrDefault(request);
    const jobGeoFilter = jobLocationMatchesEntity(entityId);
    const accountsRow = await prisma.accountsClient.findFirst({
      where: { outsourcingClientId: workspaceClientId },
      select: { id: true },
    });
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
    ] = await Promise.all([
      prisma.job.findMany({
        ...(jobGeoFilter ? { where: jobGeoFilter } : {}),
        select: {
          id: true,
          title: true,
          company: true,
          isActive: true,
          applicationCount: true,
        },
      }),
      prisma.application.findMany({
        ...(jobGeoFilter ? { where: { job: jobGeoFilter } } : {}),
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
      prisma.interview.findMany({
        ...(jobGeoFilter ? { where: { application: { job: jobGeoFilter } } } : {}),
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
        prisma.jobRequisitionApproval.count({
          where: {
            status: 'pending',
            job: jobGeoFilter ?? undefined,
          },
        })
      ),
      safeCount(() =>
        prisma.jobOfferApproval.count({
          where: {
            status: 'pending',
            application: {
              job: jobGeoFilter ?? undefined,
            },
          },
        })
      ),
      safeCount(() =>
        prisma.applicationHireConversion.count({
          where: {
            application: {
              job: jobGeoFilter ?? undefined,
            },
          },
        })
      ),
      safeCount(() =>
        prisma.employee.count({
          where: { outsourcingClientId: workspaceClientId },
        })
      ),
      safeCount(() =>
        prisma.department.count({
          where: { outsourcingClientId: workspaceClientId },
        })
      ),
      safeCount(() =>
        prisma.employeeCredential.count({
          where: { employee: { outsourcingClientId: workspaceClientId } },
        })
      ),
      safeCount(() =>
        prisma.employeeCredential.count({
          where: {
            employee: { outsourcingClientId: workspaceClientId },
            expiryDate: {
              gte: now,
              lte: expiringThreshold,
            },
          },
        })
      ),
      safeCount(() =>
        prisma.attendance.count({
          where: {
            date: { gte: monthStart },
            employee: { outsourcingClientId: workspaceClientId },
          },
        })
      ),
      safeCount(() =>
        prisma.payroll.count({
          where: { month, year, employee: { outsourcingClientId: workspaceClientId } },
        })
      ),
      safeCount(() =>
        prisma.payroll.count({
          where: { employee: { outsourcingClientId: workspaceClientId } },
        })
      ),
      safeCount(() =>
        prisma.leaveApplication.count({
          where: { status: 'pending', employee: { outsourcingClientId: workspaceClientId } },
        })
      ),
      safeCount(() =>
        prisma.leaveApplication.count({
          where: { status: 'approved', employee: { outsourcingClientId: workspaceClientId } },
        })
      ),
      safeCount(() =>
        financeClientId
          ? prisma.accountsInvoice.count({
              where: { clientId: financeClientId, status: { in: ['unpaid', 'partial'] } },
            })
          : Promise.resolve(0)
      ),
      safeCount(() => prisma.accountsVendor.count()),
      safeCount(() =>
        prisma.accountsVendorBill.count({
          where: { status: { in: ['unpaid', 'partial'] } },
        })
      ),
      safeCount(() =>
        prisma.user.count({
          where: { isActive: true },
        })
      ),
      safeCount(() =>
        prisma.essPortalUser.count({
          where: { employee: { outsourcingClientId: workspaceClientId } },
        })
      ),
      safeCount(() => prisma.auditEvent.count()),
    ]);

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
}
