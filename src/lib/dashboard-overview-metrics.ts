import { type Prisma } from '@prisma/client';
import { canAccessCredentials, canAccessPayroll } from '@/lib/demo-route-access';
import type { ModuleKey } from '@/lib/modules';
import { whereExcludeSeedStaffNotifications } from '@/lib/staff-notification-seed-filter';
import type { StaffUser } from '@/lib/staff-api-auth';
import { getRoleKeysForUser } from '@/lib/onboarding-workflows';
import { parsePinnedNavHrefs } from '@/lib/dashboard-nav-preferences';

export type OverviewCrossModuleMetrics = {
  invoicesOutstanding: number;
  vendorBillsOutstanding: number;
  activeFleetTrips: number;
  openFleetIncidents: number;
  pendingPurchaseRequests: number;
  hasFinanceClient?: boolean;
};

export type OverviewCoreMetrics = {
  totalStaff: number;
  onDuty: number;
  onLeave: number;
  pendingApprovals: number;
  openAttendanceExceptions: number;
  payroll: {
    denied: boolean;
    grossTotal: number;
    netTotal: number;
    deductionsTotal: number;
  };
  credentialsExpiring: number;
  credentialsExpired: number;
  unreadNotifications: number;
  crossModule: OverviewCrossModuleMetrics;
};

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

  const [expired, expiring] = await Promise.all([
    tx.employeeCredential.count({
      where: {
        employee: employeeScope,
        status: { notIn: ['suspended', 'revoked'] },
        expiryDate: { lt: now },
      },
    }),
    tx.employeeCredential.count({
      where: {
        employee: employeeScope,
        status: { notIn: ['suspended', 'revoked'] },
        expiryDate: { gte: now, lte: horizon },
      },
    }),
  ]);

  return { expired, expiring };
}

function moduleEnabled(modules: Record<ModuleKey, boolean>, key: ModuleKey) {
  return modules[key] === true;
}

export async function loadOverviewCoreMetrics(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    staff: StaffUser;
    clientId: string;
    enabledModules: Record<ModuleKey, boolean>;
    now?: Date;
  },
): Promise<OverviewCoreMetrics> {
  const now = params.now ?? new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const todayStr = now.toISOString().slice(0, 10);
  const startToday = new Date(`${todayStr}T00:00:00.000Z`);
  const endToday = new Date(`${todayStr}T23:59:59.999Z`);
  const modules = params.enabledModules;
  const employeeScope = {
    outsourcingClientId: params.clientId,
    client: { organizationId: params.organizationId },
  };
  const attendanceWhere = {
    outsourcingClientId: params.clientId,
    workDate: { gte: startToday, lte: startToday },
  };

  const [
    totalStaff,
    onDuty,
    openAttendanceExceptions,
    outsourcingLeave,
    staffLeave,
    payrollAgg,
    payrollDenied,
    credentialCounts,
    unreadNotifications,
    accountsClientRow,
    invoicesOutstanding,
    vendorBillsOutstanding,
    activeFleetTrips,
    openFleetIncidents,
    pendingPurchaseRequests,
  ] = await Promise.all([
    moduleEnabled(modules, 'core')
      ? tx.employee.count({ where: employeeScope })
      : Promise.resolve(0),
    moduleEnabled(modules, 'time')
      ? tx.attendanceDaySummary.count({
          where: { ...attendanceWhere, firstInAt: { not: null } },
        })
      : Promise.resolve(0),
    moduleEnabled(modules, 'time')
      ? tx.attendanceException.count({
          where: {
            status: 'open',
            employee: employeeScope,
            workDate: { gte: startToday, lte: startToday },
          },
        })
      : Promise.resolve(0),
    moduleEnabled(modules, 'leave')
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
    moduleEnabled(modules, 'leave')
      ? Promise.all([
          tx.staffLeaveApplication.count({
            where: { organizationId: params.organizationId, status: 'pending' as const },
          }),
          tx.staffLeaveApplication.count({
            where: {
              organizationId: params.organizationId,
              status: 'approved' as const,
              startDate: { lte: endToday },
              endDate: { gte: startToday },
            },
          }),
        ]).then(([pending, onLeaveToday]) => ({ pending, onLeaveToday }))
      : Promise.resolve({ pending: 0, onLeaveToday: 0 }),
    moduleEnabled(modules, 'payroll') && canAccessPayroll(params.staff)
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
    moduleEnabled(modules, 'payroll') ? Promise.resolve(!canAccessPayroll(params.staff)) : Promise.resolve(true),
    moduleEnabled(modules, 'core') && canAccessCredentials(params.staff)
      ? countScopedCredentials(tx, employeeScope)
      : Promise.resolve({ expiring: 0, expired: 0 }),
    tx.staffNotification.count({
      where: {
        userId: params.staff.id,
        readAt: null,
        ...whereExcludeSeedStaffNotifications(),
      },
    }),
    moduleEnabled(modules, 'accounts')
      ? tx.accountsClient.findFirst({
          where: { outsourcingClientId: params.clientId },
          select: { id: true },
        })
      : Promise.resolve(null),
    moduleEnabled(modules, 'accounts')
      ? safeCount(() =>
          tx.accountsInvoice.count({
            where: {
              status: { in: ['unpaid', 'partial'] },
              accountsClient: { outsourcingClientId: params.clientId },
            },
          }),
        )
      : Promise.resolve(0),
    moduleEnabled(modules, 'accounts')
      ? safeCount(() =>
          tx.accountsVendorBill.count({
            where: { status: { in: ['unpaid', 'partial'] } },
          }),
        )
      : Promise.resolve(0),
    moduleEnabled(modules, 'fleet')
      ? safeCount(() =>
          tx.fleetTrip.count({
            where: {
              outsourcingClientId: params.clientId,
              status: { in: ['allocated', 'compliance_check', 'loaded', 'in_transit'] },
            },
          }),
        )
      : Promise.resolve(0),
    moduleEnabled(modules, 'fleet')
      ? safeCount(() =>
          tx.fleetIncident.count({
            where: {
              outsourcingClientId: params.clientId,
              status: { in: ['open', 'investigating'] },
            },
          }),
        )
      : Promise.resolve(0),
    moduleEnabled(modules, 'core')
      ? safeCount(() =>
          tx.purchaseRequest.count({
            where: {
              outsourcingClientId: params.clientId,
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

  return {
    totalStaff,
    onDuty,
    onLeave: outsourcingLeave.onLeaveToday + staffLeave.onLeaveToday,
    pendingApprovals: outsourcingLeave.pending + staffLeave.pending,
    openAttendanceExceptions,
    payroll: {
      denied: payrollDenied,
      grossTotal,
      netTotal,
      deductionsTotal,
    },
    credentialsExpiring: credentialCounts.expiring,
    credentialsExpired: credentialCounts.expired,
    unreadNotifications,
    crossModule: {
      invoicesOutstanding,
      vendorBillsOutstanding,
      activeFleetTrips,
      openFleetIncidents,
      pendingPurchaseRequests,
      hasFinanceClient: Boolean(accountsClientRow),
    },
  };
}

export async function loadOverviewDetailsMetrics(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    staff: StaffUser;
    clientId: string;
    enabledModules: Record<ModuleKey, boolean>;
    now?: Date;
  },
) {
  const now = params.now ?? new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const startToday = new Date(`${todayStr}T00:00:00.000Z`);
  const endToday = new Date(`${todayStr}T23:59:59.999Z`);
  const modules = params.enabledModules;
  const employeeScope = {
    outsourcingClientId: params.clientId,
    client: { organizationId: params.organizationId },
  };
  const attendanceWhere = {
    outsourcingClientId: params.clientId,
    workDate: { gte: startToday, lte: startToday },
  };

  const [attendanceSummaries, onboardingTasks, pinnedHrefs, notificationRows] = await Promise.all([
    moduleEnabled(modules, 'time')
      ? tx.attendanceDaySummary.findMany({
          where: attendanceWhere,
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
          orderBy: [{ firstInAt: 'desc' }, { employee: { lastName: 'asc' } }],
          take: 8,
        })
      : Promise.resolve([]),
    moduleEnabled(modules, 'core')
      ? (async () => {
          const roleKeys = getRoleKeysForUser(params.staff);
          return tx.onboardingTask.findMany({
            where: {
              workflow: { employee: employeeScope },
              status: { in: ['PENDING', 'OVERDUE'] },
              OR: [{ assignedToId: params.staff.id }, { assignedRole: { in: roleKeys } }],
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
        where: { id: params.staff.id },
        select: { dashboardPinnedNav: true },
      })
      .then((user) => parsePinnedNavHrefs(user?.dashboardPinnedNav)),
    tx.staffNotification.findMany({
      where: { userId: params.staff.id, ...whereExcludeSeedStaffNotifications() },
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
  ]);

  return {
    attendanceRows: attendanceSummaries.map((row) => ({
      id: row.id,
      employee: row.employee,
      workDate: row.workDate.toISOString().slice(0, 10),
      firstInAt: row.firstInAt?.toISOString() ?? null,
      lateMinutes: row.lateMinutes,
    })),
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
    pinnedHrefs,
    notifications: notificationRows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      href: n.href,
      unread: !n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export const OVERVIEW_READ_TX_TIMEOUT_MS = 30_000;
