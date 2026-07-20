import { Prisma } from '@prisma/client';
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
  /** Open pipeline deals with no activity / update in 14+ days */
  salesStalledDeals: number;
  /** Open deals with expected close date in the past */
  salesPastDueCloses: number;
  /** Open deals expected to close in the next 7 days */
  salesClosingThisWeek: number;
  /** Weighted open pipeline (KES), rounded */
  salesWeightedPipelineKes: number;
  /** Assets currently assigned to employees */
  assetsAssigned: number;
  /** Assigned assets awaiting ESS handover acknowledgement */
  assetsPendingHandoverAck: number;
  /** Assets with warranty expiring within 30 days */
  assetsWarrantyExpiring: number;
  /** HSE incidents not yet closed */
  openHseIncidents: number;
  /** HSE corrective actions still open */
  openHseActions: number;
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

function moduleEnabled(modules: Record<ModuleKey, boolean>, key: ModuleKey) {
  return modules[key] === true;
}

/** Row shape returned by the single combined overview-core aggregate query. */
type OverviewCoreRow = {
  totalStaff: number;
  onDuty: number;
  openAttendanceExceptions: number;
  leavePending: number;
  leaveOnToday: number;
  staffLeavePending: number;
  staffLeaveOnToday: number;
  credentialsExpired: number;
  credentialsExpiring: number;
  unreadNotifications: number;
  grossTotal: number;
  netTotal: number;
  deductionsTotal: number;
  hasFinanceClient: boolean;
  invoicesOutstanding: number;
  vendorBillsOutstanding: number;
  activeFleetTrips: number;
  openFleetIncidents: number;
  pendingPurchaseRequests: number;
  salesStalledDeals: number;
  salesPastDueCloses: number;
  salesClosingThisWeek: number;
  salesWeightedPipelineKes: number;
  assetsAssigned: number;
  assetsPendingHandoverAck: number;
  assetsWarrantyExpiring: number;
  openHseIncidents: number;
  openHseActions: number;
};

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
  const weekEndStr = new Date(startToday.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const horizon30 = new Date(now);
  horizon30.setDate(horizon30.getDate() + 30);
  const horizon90 = new Date(now);
  horizon90.setDate(horizon90.getDate() + 90);
  const stalledBefore = new Date(now.getTime() - 14 * 86400000);
  const modules = params.enabledModules;

  const clientId = params.clientId;
  const userId = params.staff.id;
  const payrollDenied = moduleEnabled(modules, 'payroll') ? !canAccessPayroll(params.staff) : true;

  // Employees belonging to the active workspace client — used to scope the
  // employee-linked tables. RLS (app.current_org) enforces org isolation on top.
  const scopedEmployeeIds = Prisma.sql`SELECT "id" FROM "Employee" WHERE "outsourcingClientId" = ${clientId}`;
  const openStages = Prisma.sql`('lead','qualified','proposal','negotiation')`;

  // A metric column: run the subquery when its module/access gate is on,
  // otherwise select a constant so the result row shape stays stable and no
  // needless work hits the database.
  const col = (enabled: boolean, expr: Prisma.Sql, fallback: Prisma.Sql, name: string) =>
    Prisma.sql`${enabled ? expr : fallback} AS ${Prisma.raw(`"${name}"`)}`;
  const zero = Prisma.sql`0`;
  const falseVal = Prisma.sql`FALSE`;

  const core = moduleEnabled(modules, 'core');
  const time = moduleEnabled(modules, 'time');
  const leave = moduleEnabled(modules, 'leave');
  const payroll = moduleEnabled(modules, 'payroll') && canAccessPayroll(params.staff);
  const credentials = core && canAccessCredentials(params.staff);
  const accounts = moduleEnabled(modules, 'accounts');
  const fleet = moduleEnabled(modules, 'fleet');
  const sales = moduleEnabled(modules, 'sales');
  const assets = moduleEnabled(modules, 'assets');
  const hse = moduleEnabled(modules, 'hse');

  const columns: Prisma.Sql[] = [
    col(core, Prisma.sql`(SELECT COUNT(*)::int FROM "Employee" WHERE "outsourcingClientId" = ${clientId})`, zero, 'totalStaff'),
    col(time, Prisma.sql`(SELECT COUNT(*)::int FROM "AttendanceDaySummary" WHERE "outsourcingClientId" = ${clientId} AND "workDate" = ${todayStr}::date AND "firstInAt" IS NOT NULL)`, zero, 'onDuty'),
    col(time, Prisma.sql`(SELECT COUNT(*)::int FROM "AttendanceException" WHERE "status"::text = 'open' AND "workDate" = ${todayStr}::date AND "employeeId" IN (${scopedEmployeeIds}))`, zero, 'openAttendanceExceptions'),
    col(leave, Prisma.sql`(SELECT COUNT(*)::int FROM "LeaveApplication" WHERE "status"::text = 'pending' AND "employeeId" IN (${scopedEmployeeIds}))`, zero, 'leavePending'),
    col(leave, Prisma.sql`(SELECT COUNT(*)::int FROM "LeaveApplication" WHERE "status"::text = 'approved' AND "startDate" <= ${endToday} AND "endDate" >= ${startToday} AND "employeeId" IN (${scopedEmployeeIds}))`, zero, 'leaveOnToday'),
    col(leave, Prisma.sql`(SELECT COUNT(*)::int FROM "StaffLeaveApplication" WHERE "status"::text = 'pending')`, zero, 'staffLeavePending'),
    col(leave, Prisma.sql`(SELECT COUNT(*)::int FROM "StaffLeaveApplication" WHERE "status"::text = 'approved' AND "startDate" <= ${endToday} AND "endDate" >= ${startToday})`, zero, 'staffLeaveOnToday'),
    col(credentials, Prisma.sql`(SELECT COUNT(*)::int FROM "EmployeeCredential" WHERE "status"::text NOT IN ('suspended','revoked') AND "expiryDate" < ${now} AND "employeeId" IN (${scopedEmployeeIds}))`, zero, 'credentialsExpired'),
    col(credentials, Prisma.sql`(SELECT COUNT(*)::int FROM "EmployeeCredential" WHERE "status"::text NOT IN ('suspended','revoked') AND "expiryDate" >= ${now} AND "expiryDate" <= ${horizon90} AND "employeeId" IN (${scopedEmployeeIds}))`, zero, 'credentialsExpiring'),
    col(true, Prisma.sql`(SELECT COUNT(*)::int FROM "StaffNotification" WHERE "userId" = ${userId} AND "readAt" IS NULL AND "title" NOT LIKE '[SEED_ACCOUNTS]%' AND "title" NOT LIKE '[SEED_INVOICE]%')`, zero, 'unreadNotifications'),
    col(payroll, Prisma.sql`(SELECT COALESCE(SUM("grossPay"),0)::float8 FROM "Payroll" WHERE "month" = ${month} AND "year" = ${year} AND "employeeId" IN (${scopedEmployeeIds}))`, zero, 'grossTotal'),
    col(payroll, Prisma.sql`(SELECT COALESCE(SUM("netPay"),0)::float8 FROM "Payroll" WHERE "month" = ${month} AND "year" = ${year} AND "employeeId" IN (${scopedEmployeeIds}))`, zero, 'netTotal'),
    col(payroll, Prisma.sql`(SELECT COALESCE(SUM("paye" + "nssf" + "nhif" + "ahl"),0)::float8 FROM "Payroll" WHERE "month" = ${month} AND "year" = ${year} AND "employeeId" IN (${scopedEmployeeIds}))`, zero, 'deductionsTotal'),
    col(accounts, Prisma.sql`(SELECT EXISTS(SELECT 1 FROM "AccountsClient" WHERE "outsourcingClientId" = ${clientId}))`, falseVal, 'hasFinanceClient'),
    col(accounts, Prisma.sql`(SELECT COUNT(*)::int FROM "AccountsInvoice" WHERE "status"::text IN ('unpaid','partial') AND "clientId" IN (SELECT "id" FROM "AccountsClient" WHERE "outsourcingClientId" = ${clientId}))`, zero, 'invoicesOutstanding'),
    col(accounts, Prisma.sql`(SELECT COUNT(*)::int FROM "AccountsVendorBill" WHERE "status"::text IN ('unpaid','partial'))`, zero, 'vendorBillsOutstanding'),
    col(fleet, Prisma.sql`(SELECT COUNT(*)::int FROM "FleetTrip" WHERE "outsourcingClientId" = ${clientId} AND "status"::text IN ('allocated','compliance_check','loaded','in_transit'))`, zero, 'activeFleetTrips'),
    col(fleet, Prisma.sql`(SELECT COUNT(*)::int FROM "FleetIncident" WHERE "outsourcingClientId" = ${clientId} AND "status"::text IN ('open','investigating'))`, zero, 'openFleetIncidents'),
    col(core, Prisma.sql`(SELECT COUNT(*)::int FROM "PurchaseRequest" WHERE "outsourcingClientId" = ${clientId} AND "status"::text = 'submitted')`, zero, 'pendingPurchaseRequests'),
    col(sales, Prisma.sql`(SELECT COUNT(*)::int FROM "SalesDeal" WHERE "stage"::text IN ${openStages} AND "updatedAt" < ${stalledBefore})`, zero, 'salesStalledDeals'),
    col(sales, Prisma.sql`(SELECT COUNT(*)::int FROM "SalesDeal" WHERE "stage"::text IN ${openStages} AND "expectedCloseDate" < ${todayStr}::date)`, zero, 'salesPastDueCloses'),
    col(sales, Prisma.sql`(SELECT COUNT(*)::int FROM "SalesDeal" WHERE "stage"::text IN ${openStages} AND "expectedCloseDate" >= ${todayStr}::date AND "expectedCloseDate" <= ${weekEndStr}::date)`, zero, 'salesClosingThisWeek'),
    col(sales, Prisma.sql`(SELECT COALESCE(ROUND(SUM("value" * "probability" / 100.0)),0)::float8 FROM "SalesDeal" WHERE "stage"::text IN ${openStages})`, zero, 'salesWeightedPipelineKes'),
    col(assets, Prisma.sql`(SELECT COUNT(*)::int FROM "CompanyAsset" WHERE "outsourcingClientId" = ${clientId} AND "status"::text = 'assigned')`, zero, 'assetsAssigned'),
    col(assets, Prisma.sql`(SELECT COUNT(*)::int FROM "CompanyAsset" WHERE "outsourcingClientId" = ${clientId} AND "status"::text = 'assigned' AND "assignedEmployeeId" IS NOT NULL AND "handoverAcknowledgedAt" IS NULL)`, zero, 'assetsPendingHandoverAck'),
    col(assets, Prisma.sql`(SELECT COUNT(*)::int FROM "CompanyAsset" WHERE "outsourcingClientId" = ${clientId} AND "warrantyExpiry" >= ${now} AND "warrantyExpiry" <= ${horizon30} AND "status"::text NOT IN ('retired','lost'))`, zero, 'assetsWarrantyExpiring'),
    col(hse, Prisma.sql`(SELECT COUNT(*)::int FROM "HseIncident" WHERE "outsourcingClientId" = ${clientId} AND "status"::text IN ('open','investigating'))`, zero, 'openHseIncidents'),
    col(hse, Prisma.sql`(SELECT COUNT(*)::int FROM "HseAction" WHERE "outsourcingClientId" = ${clientId} AND "status"::text IN ('open','in_progress'))`, zero, 'openHseActions'),
  ];

  // One round-trip computes every metric on the caller's tenant transaction,
  // instead of ~25 serial count queries — critical when the database is far
  // from the app.
  const rows = await tx.$queryRaw<OverviewCoreRow[]>(
    Prisma.sql`SELECT ${Prisma.join(columns, ', ')}`,
  );
  const r = rows[0];

  return {
    totalStaff: r.totalStaff,
    onDuty: r.onDuty,
    onLeave: r.leaveOnToday + r.staffLeaveOnToday,
    pendingApprovals: r.leavePending + r.staffLeavePending,
    openAttendanceExceptions: r.openAttendanceExceptions,
    payroll: {
      denied: payrollDenied,
      grossTotal: r.grossTotal,
      netTotal: r.netTotal,
      deductionsTotal: r.deductionsTotal,
    },
    credentialsExpiring: r.credentialsExpiring,
    credentialsExpired: r.credentialsExpired,
    unreadNotifications: r.unreadNotifications,
    crossModule: {
      invoicesOutstanding: r.invoicesOutstanding,
      vendorBillsOutstanding: r.vendorBillsOutstanding,
      activeFleetTrips: r.activeFleetTrips,
      openFleetIncidents: r.openFleetIncidents,
      pendingPurchaseRequests: r.pendingPurchaseRequests,
      hasFinanceClient: r.hasFinanceClient,
      salesStalledDeals: r.salesStalledDeals,
      salesPastDueCloses: r.salesPastDueCloses,
      salesClosingThisWeek: r.salesClosingThisWeek,
      salesWeightedPipelineKes: r.salesWeightedPipelineKes,
      assetsAssigned: r.assetsAssigned,
      assetsPendingHandoverAck: r.assetsPendingHandoverAck,
      assetsWarrantyExpiring: r.assetsWarrantyExpiring,
      openHseIncidents: r.openHseIncidents,
      openHseActions: r.openHseActions,
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
          firstName: task.workflow.employee?.firstName ?? '',
          lastName: task.workflow.employee?.lastName ?? '',
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
