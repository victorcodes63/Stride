import { CredentialStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loadCompanySetupSettings } from '@/lib/company-setup';
import {
  getUserPinnedNavHrefs,
} from '@/lib/dashboard-nav-preferences';
import { canAccessCredentials, canAccessPayroll, unauthorizedResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { resolveEffectiveModules, isModuleLicensed, type ModuleKey } from '@/lib/modules';
import { getRoleKeysForUser } from '@/lib/onboarding-workflows';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { whereExcludeSeedStaffNotifications } from '@/lib/staff-notification-seed-filter';
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

async function countScopedCredentials(employeeScope: { outsourcingClientId: string }) {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 90);

  const [expired, expiringRows] = await Promise.all([
    prisma.employeeCredential.count({
      where: {
        employee: employeeScope,
        status: { notIn: ['suspended', 'revoked'] },
        expiryDate: { lt: now },
      },
    }),
    prisma.employeeCredential.findMany({
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
  const staffUser = await requireStaffUser(request);
  if (!staffUser) return unauthorizedResponse();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const metricsOnly = request.nextUrl.searchParams.get('metricsOnly') === '1';

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const todayStr = now.toISOString().slice(0, 10);
  const startToday = new Date(`${todayStr}T00:00:00.000Z`);
  const endToday = new Date(`${todayStr}T23:59:59.999Z`);

  try {
    const [fullUser, clientId, setup] = await Promise.all([
      metricsOnly ? Promise.resolve(null) : prisma.user.findUnique({ where: { id: staffUser.id } }),
      resolvePrimaryWorkspaceClientId(prisma, undefined, request),
      metricsOnly ? Promise.resolve(null) : loadCompanySetupSettings(),
    ]);

    if (!metricsOnly && !fullUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const modules = metricsOnly ? null : resolveEffectiveModules(setup!.moduleAdminFlags);
    const employeeScope = { outsourcingClientId: clientId };
    const attendanceWhere = {
      outsourcingClientId: clientId,
      workDate: { gte: startToday, lte: startToday },
    };

    const licensed = (key: ModuleKey) =>
      metricsOnly ? isModuleLicensed(key) : isModuleLicensed(key) && modules![key] !== false;

    const [
      me,
      totalStaff,
      attendanceSummaries,
      onDuty,
      openAttendanceExceptions,
      outsourcingLeave,
      staffLeave,
      payrollAgg,
      payrollDenied,
      credentialCounts,
      onboardingTasks,
      pinnedHrefs,
      notificationRows,
      unreadNotifications,
      accountsClientRow,
      invoicesOutstanding,
      vendorBillsOutstanding,
      activeFleetTrips,
      openFleetIncidents,
      pendingPurchaseRequests,
    ] = await Promise.all([
      metricsOnly ? Promise.resolve(null) : userRowToSummary(fullUser!),
      licensed('core')
        ? prisma.employee.count({ where: employeeScope })
        : Promise.resolve(0),
      licensed('time')
        ? prisma.attendanceDaySummary.findMany({
            where: attendanceWhere,
            include: {
              employee: { select: { firstName: true, lastName: true } },
            },
            orderBy: [{ firstInAt: 'desc' }, { employee: { lastName: 'asc' } }],
            take: 8,
          })
        : Promise.resolve([]),
      licensed('time')
        ? prisma.attendanceDaySummary.count({
            where: { ...attendanceWhere, firstInAt: { not: null } },
          })
        : Promise.resolve(0),
      licensed('time')
        ? prisma.attendanceException.count({
            where: {
              status: 'open',
              employee: employeeScope,
              workDate: { gte: startToday, lte: startToday },
            },
          })
        : Promise.resolve(0),
      licensed('leave')
        ? Promise.all([
            prisma.leaveApplication.count({
              where: { status: 'pending', employee: employeeScope },
            }),
            prisma.leaveApplication.count({
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
            prisma.staffLeaveApplication.count({ where: { status: 'pending' } }),
            prisma.staffLeaveApplication.count({
              where: {
                status: 'approved',
                startDate: { lte: endToday },
                endDate: { gte: startToday },
              },
            }),
          ]).then(([pending, onLeaveToday]) => ({ pending, onLeaveToday }))
        : Promise.resolve({ pending: 0, onLeaveToday: 0 }),
      licensed('payroll') && canAccessPayroll(staffUser)
        ? prisma.payroll.aggregate({
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
      licensed('payroll') ? Promise.resolve(!canAccessPayroll(staffUser)) : Promise.resolve(true),
      licensed('core') && canAccessCredentials(staffUser)
        ? countScopedCredentials(employeeScope)
        : Promise.resolve({ expiring: 0, expired: 0 }),
      licensed('core')
        ? (async () => {
            const roleKeys = getRoleKeysForUser(staffUser);
            return prisma.onboardingTask.findMany({
              where: {
                workflow: { employee: employeeScope },
                status: { in: ['PENDING', 'OVERDUE'] },
                OR: [{ assignedToId: staffUser.id }, { assignedRole: { in: roleKeys } }],
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
      getUserPinnedNavHrefs(staffUser.id),
      prisma.staffNotification.findMany({
        where: { userId: staffUser.id, ...whereExcludeSeedStaffNotifications() },
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
      prisma.staffNotification.count({
        where: { userId: staffUser.id, readAt: null, ...whereExcludeSeedStaffNotifications() },
      }),
      licensed('accounts')
        ? prisma.accountsClient.findFirst({
            where: { outsourcingClientId: clientId },
            select: { id: true },
          })
        : Promise.resolve(null),
      licensed('accounts')
        ? safeCount(() =>
            prisma.accountsInvoice.count({
              where: {
                status: { in: ['unpaid', 'partial'] },
                client: { outsourcingClientId: clientId },
              },
            }),
          )
        : Promise.resolve(0),
      licensed('accounts')
        ? safeCount(() =>
            prisma.accountsVendorBill.count({
              where: { status: { in: ['unpaid', 'partial'] } },
            }),
          )
        : Promise.resolve(0),
      licensed('fleet')
        ? safeCount(() =>
            prisma.fleetTrip.count({
              where: {
                outsourcingClientId: clientId,
                status: { in: ['allocated', 'compliance_check', 'loaded', 'in_transit'] },
              },
            }),
          )
        : Promise.resolve(0),
      licensed('fleet')
        ? safeCount(() =>
            prisma.fleetIncident.count({
              where: {
                outsourcingClientId: clientId,
                status: { in: ['open', 'investigating'] },
              },
            }),
          )
        : Promise.resolve(0),
      licensed('core')
        ? safeCount(() =>
            prisma.purchaseRequest.count({
              where: {
                outsourcingClientId: clientId,
                status: 'submitted',
              },
            }),
          )
        : Promise.resolve(0),
    ]);

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
}
