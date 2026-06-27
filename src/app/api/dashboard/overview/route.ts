import { CredentialStatus, type Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { loadCompanySetupSettingsForOrg } from '@/lib/company-setup';
import { parsePinnedNavHrefs } from '@/lib/dashboard-nav-preferences';
import { canAccessCredentials, canAccessPayroll } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { resolveEffectiveModules, isModuleLicensed, type ModuleKey } from '@/lib/modules';
import { getRoleKeysForUser } from '@/lib/onboarding-workflows';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { whereExcludeSeedStaffNotifications } from '@/lib/staff-notification-seed-filter';
import { withTenant } from '@/lib/tenant-api';
import { userRowToSummary } from '@/lib/user-summary-api';

export const dynamic = 'force-dynamic';

function deriveCredentialEffectiveStatus(
  status: CredentialStatus,
  expiryDate: Date | null,
  reminderDays: number,
): CredentialStatus {
  if (status === 'suspended' || status === 'revoked') return status;
  if (!expiryDate) return status;

  const ms = expiryDate.getTime() - Date.now();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= reminderDays) return 'expiring_soon';
  return 'active';
}

function countCredentialStatuses(
  rows: { status: CredentialStatus; expiryDate: Date | null; reminderDays: number }[],
) {
  let expiring = 0;
  let expired = 0;
  for (const row of rows) {
    const effective = deriveCredentialEffectiveStatus(row.status, row.expiryDate, row.reminderDays);
    if (effective === 'expired') expired += 1;
    else if (effective === 'expiring_soon') expiring += 1;
  }
  return { expiring, expired };
}

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

async function countScopedCredentials(
  tx: Prisma.TransactionClient,
  employeeScope: { outsourcingClientId: string; client: { organizationId: string } },
) {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 90);

  const [expired, expiringRows] = await Promise.all([
    tx.employeeCredential.count({
      where: {
        employee: employeeScope,
        status: { notIn: ['suspended', 'revoked'] },
        expiryDate: { lt: now },
      },
    }),
    tx.employeeCredential.findMany({
      where: {
        employee: employeeScope,
        status: { notIn: ['suspended', 'revoked'] },
        expiryDate: { gte: now, lte: horizon },
      },
      select: { status: true, expiryDate: true, reminderDays: true },
    }),
  ]);

  const expiring = countCredentialStatuses(expiringRows).expiring;
  return { expired, expiring };
}

/** GET — aggregated dashboard overview payload (single round-trip for /dashboard). */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const metricsOnly = request.nextUrl.searchParams.get('metricsOnly') === '1';
    const sliceParam = request.nextUrl.searchParams.get('slice');
    const slice = sliceParam === 'core' || sliceParam === 'details' ? sliceParam : 'all';
    const loadCore = slice === 'all' || slice === 'core';
    const loadDetails = slice === 'all' || slice === 'details';

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const todayStr = now.toISOString().slice(0, 10);
    const startToday = new Date(`${todayStr}T00:00:00.000Z`);
    const endToday = new Date(`${todayStr}T23:59:59.999Z`);

    try {
      const setup = metricsOnly ? null : await loadCompanySetupSettingsForOrg(ctx.organizationId);
      const modules = metricsOnly ? null : resolveEffectiveModules(setup!.moduleAdminFlags);

      const licensed = (key: ModuleKey) =>
        metricsOnly ? isModuleLicensed(key) : isModuleLicensed(key) && modules![key] !== false;

      const dbResult = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );

        let fullUser = null;
        if (!metricsOnly) {
          fullUser = await tx.user.findUnique({ where: { id: ctx.staff.id } });
          if (!fullUser) return { notFound: true as const };
        }

        const employeeScope = {
          outsourcingClientId: clientId,
          client: { organizationId: ctx.organizationId },
        };
        const attendanceWhere = {
          outsourcingClientId: clientId,
          workDate: { gte: startToday, lte: startToday },
        };

        const corePromise = loadCore
          ? Promise.all([
              licensed('core')
                ? tx.employee.count({ where: employeeScope })
                : Promise.resolve(0),
              licensed('time')
                ? tx.attendanceDaySummary.count({
                    where: { ...attendanceWhere, firstInAt: { not: null } },
                  })
                : Promise.resolve(0),
              licensed('time')
                ? tx.attendanceException.count({
                    where: {
                      status: 'open',
                      employee: employeeScope,
                      workDate: { gte: startToday, lte: startToday },
                    },
                  })
                : Promise.resolve(0),
              licensed('leave')
                ? Promise.all([
                    tx.leaveApplication.count({
                      where: { status: 'pending', employee: employeeScope },
                    }),
                    tx.leaveApplication.count({
                      where: {
                        status: 'approved',
                        employee: employeeScope,
                        startDate: { lte: endToday },
                        endDate: { gte: startToday },
                      },
                    }),
                  ]).then(([pending, onLeaveToday]) => ({ pending, onLeaveToday }))
                : Promise.resolve({ pending: 0, onLeaveToday: 0 }),
              licensed('leave')
                ? Promise.all([
                    tx.staffLeaveApplication.count({ where: ctx.where({ status: 'pending' as const }) }),
                    tx.staffLeaveApplication.count({
                      where: ctx.where({
                        status: 'approved' as const,
                        startDate: { lte: endToday },
                        endDate: { gte: startToday },
                      }),
                    }),
                  ]).then(([pending, onLeaveToday]) => ({ pending, onLeaveToday }))
                : Promise.resolve({ pending: 0, onLeaveToday: 0 }),
              licensed('payroll') && canAccessPayroll(ctx.staff)
                ? tx.payroll.aggregate({
                    where: { month, year, employee: employeeScope },
                    _sum: {
                      grossPay: true,
                      netPay: true,
                      paye: true,
                      nssf: true,
                      nhif: true,
                      ahl: true,
                    },
                  })
                : Promise.resolve(null),
              licensed('payroll') ? Promise.resolve(!canAccessPayroll(ctx.staff)) : Promise.resolve(true),
              licensed('core') && canAccessCredentials(ctx.staff)
                ? countScopedCredentials(tx, employeeScope)
                : Promise.resolve({ expiring: 0, expired: 0 }),
              tx.staffNotification.count({
                where: {
                  userId: ctx.staff.id,
                  readAt: null,
                  ...whereExcludeSeedStaffNotifications(),
                },
              }),
              licensed('accounts')
                ? tx.accountsClient.findFirst({
                    where: { outsourcingClientId: clientId },
                    select: { id: true },
                  })
                : Promise.resolve(null),
              licensed('accounts')
                ? safeCount(() =>
                    tx.accountsInvoice.count({
                      where: {
                        status: { in: ['unpaid', 'partial'] },
                        accountsClient: { outsourcingClientId: clientId },
                      },
                    }),
                  )
                : Promise.resolve(0),
              licensed('accounts')
                ? safeCount(() =>
                    tx.accountsVendorBill.count({
                      where: { status: { in: ['unpaid', 'partial'] } },
                    }),
                  )
                : Promise.resolve(0),
              licensed('fleet')
                ? safeCount(() =>
                    tx.fleetTrip.count({
                      where: {
                        outsourcingClientId: clientId,
                        status: { in: ['allocated', 'compliance_check', 'loaded', 'in_transit'] },
                      },
                    }),
                  )
                : Promise.resolve(0),
              licensed('fleet')
                ? safeCount(() =>
                    tx.fleetIncident.count({
                      where: {
                        outsourcingClientId: clientId,
                        status: { in: ['open', 'investigating'] },
                      },
                    }),
                  )
                : Promise.resolve(0),
              licensed('core')
                ? safeCount(() =>
                    tx.purchaseRequest.count({
                      where: {
                        outsourcingClientId: clientId,
                        status: 'submitted',
                      },
                    }),
                  )
                : Promise.resolve(0),
            ])
          : Promise.resolve(null);

        const detailsPromise = loadDetails
          ? Promise.all([
              licensed('time')
                ? tx.attendanceDaySummary.findMany({
                    where: attendanceWhere,
                    include: {
                      employee: { select: { firstName: true, lastName: true } },
                    },
                    orderBy: [{ firstInAt: 'desc' }, { employee: { lastName: 'asc' } }],
                    take: 8,
                  })
                : Promise.resolve([]),
              licensed('core')
                ? (async () => {
                    const roleKeys = getRoleKeysForUser(ctx.staff);
                    return tx.onboardingTask.findMany({
                      where: {
                        workflow: { employee: employeeScope },
                        status: { in: ['PENDING', 'OVERDUE'] },
                        OR: [{ assignedToId: ctx.staff.id }, { assignedRole: { in: roleKeys } }],
                      },
                      include: {
                        workflow: {
                          include: { employee: { select: { firstName: true, lastName: true } } },
                        },
                      },
                      orderBy: [{ dueDate: 'asc' }, { order: 'asc' }],
                      take: 5,
                    });
                  })()
                : Promise.resolve([]),
              tx.user
                .findUnique({
                  where: { id: ctx.staff.id },
                  select: { dashboardPinnedNav: true },
                })
                .then((user) => parsePinnedNavHrefs(user?.dashboardPinnedNav)),
              tx.staffNotification.findMany({
                where: { userId: ctx.staff.id, ...whereExcludeSeedStaffNotifications() },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: {
                  id: true,
                  title: true,
                  body: true,
                  readAt: true,
                  href: true,
                  createdAt: true,
                },
              }),
            ])
          : Promise.resolve(null);

        const [coreResults, detailsResults] = await Promise.all([corePromise, detailsPromise]);

        return { notFound: false as const, fullUser, coreResults, detailsResults };
      });

      if (dbResult.notFound) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      }

      const { fullUser, coreResults, detailsResults } = dbResult;

      const me = metricsOnly ? null : await userRowToSummary(fullUser!);

      const totalStaff = coreResults?.[0] ?? 0;
      const onDuty = coreResults?.[1] ?? 0;
      const openAttendanceExceptions = coreResults?.[2] ?? 0;
      const outsourcingLeave = coreResults?.[3] ?? { pending: 0, onLeaveToday: 0 };
      const staffLeave = coreResults?.[4] ?? { pending: 0, onLeaveToday: 0 };
      const payrollAgg = coreResults?.[5] ?? null;
      const payrollDenied = coreResults?.[6] ?? true;
      const credentialCounts = coreResults?.[7] ?? { expiring: 0, expired: 0 };
      const unreadNotifications = coreResults?.[8] ?? 0;
      const accountsClientRow = coreResults?.[9] ?? null;
      const invoicesOutstanding = coreResults?.[10] ?? 0;
      const vendorBillsOutstanding = coreResults?.[11] ?? 0;
      const activeFleetTrips = coreResults?.[12] ?? 0;
      const openFleetIncidents = coreResults?.[13] ?? 0;
      const pendingPurchaseRequests = coreResults?.[14] ?? 0;

      const attendanceSummaries = detailsResults?.[0] ?? [];
      const onboardingTasks = detailsResults?.[1] ?? [];
      const pinnedHrefs = detailsResults?.[2] ?? [];
      const notificationRows = detailsResults?.[3] ?? [];

      const grossTotal = Number(payrollAgg?._sum.grossPay ?? 0);
      const netTotal = Number(payrollAgg?._sum.netPay ?? 0);
      const deductionsTotal =
        Number(payrollAgg?._sum.paye ?? 0) +
        Number(payrollAgg?._sum.nssf ?? 0) +
        Number(payrollAgg?._sum.nhif ?? 0) +
        Number(payrollAgg?._sum.ahl ?? 0);

      return NextResponse.json({
        ...(me ? { me } : {}),
        ...(modules ? { modules } : {}),
        totalStaff,
        onDuty,
        onLeave: outsourcingLeave.onLeaveToday + staffLeave.onLeaveToday,
        pendingApprovals: outsourcingLeave.pending + staffLeave.pending,
        attendanceRows: attendanceSummaries.map((row) => ({
          id: row.id,
          employee: row.employee,
          workDate: row.workDate.toISOString().slice(0, 10),
          firstInAt: row.firstInAt?.toISOString() ?? null,
          lateMinutes: row.lateMinutes,
        })),
        openAttendanceExceptions,
        payroll: {
          denied: payrollDenied,
          grossTotal,
          netTotal,
          deductionsTotal,
        },
        myOnboardingTasks: onboardingTasks.map((task) => ({
          id: task.id,
          title: task.title,
          dueDate: task.dueDate?.toISOString() ?? null,
          status: task.status,
          workflow: {
            employee: {
              firstName: task.workflow.employee.firstName,
              lastName: task.workflow.employee.lastName,
            },
          },
        })),
        credentialsExpiring: credentialCounts.expiring,
        credentialsExpired: credentialCounts.expired,
        pinnedHrefs,
        notifications: notificationRows.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          href: n.href,
          unread: !n.readAt,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadNotifications,
        crossModule: {
          invoicesOutstanding,
          vendorBillsOutstanding,
          activeFleetTrips,
          openFleetIncidents,
          pendingPurchaseRequests,
          hasFinanceClient: Boolean(accountsClientRow),
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/dashboard/overview',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load dashboard overview.' }, { status: 500 });
    }
  });
}
