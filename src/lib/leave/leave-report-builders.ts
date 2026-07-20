import type { Prisma } from '@prisma/client';
import { STAFF_USER_TYPE_LABELS } from '@/lib/staff-permissions';
import type { StaffUserType } from '@/types/dashboard';
import { dailyRateFromSalary, computeLeaveLiability } from '@/lib/leave/employee-overview';
import type {
  LeaveReportDataset,
  LeaveReportPerson,
  LeaveReportBalance,
  LeaveReportApplication,
  LeaveReportLiabilityRow,
} from '@/lib/leave/leave-report';

type Tx = Prisma.TransactionClient;

/** Stable colour per leave type so calendars/legends read well even when the DB has no colour. */
const LEAVE_TYPE_COLORS = ['#2563eb', '#dc2626', '#7c3aed', '#0891b2', '#ca8a04', '#059669', '#db2777', '#475569'];
const LEAVE_TYPE_OVERRIDES: Record<string, string> = {
  annual: '#2563eb',
  sick: '#dc2626',
  maternity: '#db2777',
  paternity: '#0891b2',
  compassionate: '#7c3aed',
  study: '#ca8a04',
};

function leaveTypeColor(name: string): string {
  const key = name.trim().toLowerCase();
  for (const [needle, color] of Object.entries(LEAVE_TYPE_OVERRIDES)) {
    if (key.includes(needle)) return color;
  }
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return LEAVE_TYPE_COLORS[hash % LEAVE_TYPE_COLORS.length];
}

function yearBounds(year: number): { start: Date; end: Date } {
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) };
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isPending(status: string): boolean {
  return status === 'pending' || status === 'in_progress';
}

// ————————————————————————————————————————————————————————————————
// Internal staff (User + StaffLeave*)
// ————————————————————————————————————————————————————————————————

export async function buildStaffLeaveReport(
  tx: Tx,
  args: { organizationId: string; memberIds: string[]; year: number },
): Promise<LeaveReportDataset> {
  const { organizationId, memberIds, year } = args;
  const { start, end } = yearBounds(year);

  const [org, users, approverCandidates] = await Promise.all([
    tx.organization.findUnique({ where: { id: organizationId }, select: { name: true, currency: true } }),
    tx.user.findMany({
      where: { id: { in: memberIds }, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        staffUserType: true,
        leaveApproverId: true,
        department: true,
        costCenterCode: true,
        costCenterName: true,
        monthlySalary: true,
        staffLeaveBalances: {
          where: { organizationId, year },
          include: { leaveType: { select: { id: true, name: true, color: true, sortOrder: true } } },
        },
        staffLeaveApplications: {
          where: { organizationId, startDate: { gte: start, lte: end } },
          include: { leaveType: { select: { name: true, color: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    tx.user.findMany({
      where: { isActive: true, OR: [{ role: 'admin' }, { staffUserType: 'business_manager' }] },
      select: { id: true, name: true },
    }),
  ]);

  const approverNameById = new Map(approverCandidates.map((a) => [a.id, a.name]));
  const fallbackApprovers = approverCandidates.map((a) => a.name).slice(0, 4);

  const hasMonetaryLiability = users.some((u) => u.monthlySalary != null && Number(u.monthlySalary) > 0);

  const people: LeaveReportPerson[] = users.map((u) => {
    const dailyRate = u.monthlySalary != null && Number(u.monthlySalary) > 0
      ? dailyRateFromSalary(Number(u.monthlySalary))
      : null;
    const balances: LeaveReportBalance[] = u.staffLeaveBalances
      .slice()
      .sort((a, b) => a.leaveType.sortOrder - b.leaveType.sortOrder)
      .map((b) => {
        const entitled = b.entitledDays + b.carriedOver;
        const pending = u.staffLeaveApplications
          .filter((a) => a.leaveTypeId === b.leaveTypeId && isPending(a.status))
          .reduce((s, a) => s + a.totalDays, 0);
        return {
          leaveTypeName: b.leaveType.name,
          color: b.leaveType.color,
          entitled,
          used: b.usedDays,
          pending,
          remaining: entitled - b.usedDays,
        };
      });

    const applications: LeaveReportApplication[] = u.staffLeaveApplications.map((a) => ({
      leaveTypeName: a.leaveType.name,
      startDate: iso(a.startDate),
      endDate: iso(a.endDate),
      days: a.totalDays,
      status: a.status,
    }));

    const annualBal = balances.find((b) => /annual/i.test(b.leaveTypeName));
    const annual = annualBal
      ? { entitled: annualBal.entitled, used: annualBal.used, pending: annualBal.pending, remaining: annualBal.remaining }
      : { entitled: 0, used: 0, pending: 0, remaining: 0 };

    const ytdTaken = u.staffLeaveApplications
      .filter((a) => a.status === 'approved')
      .reduce((s, a) => s + a.totalDays, 0);

    const liability: LeaveReportLiabilityRow[] = balances
      .filter((b) => b.remaining > 0)
      .map((b) => ({
        leaveTypeName: b.leaveTypeName,
        remainingDays: b.remaining,
        dailyRate,
        amount: dailyRate != null ? computeLeaveLiability(b.remaining, dailyRate) : null,
      }));
    const liabilityTotal = dailyRate != null ? liability.reduce((s, r) => s + (r.amount ?? 0), 0) : null;

    const approvers = u.leaveApproverId && approverNameById.has(u.leaveApproverId)
      ? [approverNameById.get(u.leaveApproverId)!]
      : fallbackApprovers;

    const roleLabel = STAFF_USER_TYPE_LABELS[u.staffUserType as StaffUserType] ?? u.staffUserType;

    return {
      id: u.id,
      name: u.name,
      identifier: u.email,
      group: u.department?.trim() || roleLabel,
      costCenter: u.costCenterName?.trim() || u.costCenterCode?.trim() || null,
      annual,
      ytdTaken,
      balances,
      applications,
      liability,
      liabilityTotal,
      approvers,
    };
  });

  return {
    audience: 'staff',
    title: 'Internal staff',
    orgName: org?.name ?? 'Organisation',
    year,
    currency: org?.currency ?? 'KES',
    hasMonetaryLiability,
    groupLabel: 'Department',
    people,
  };
}

// ————————————————————————————————————————————————————————————————
// Outsourced workforce (Employee + Leave*)
// ————————————————————————————————————————————————————————————————

export async function buildOutsourcedLeaveReport(
  tx: Tx,
  args: { organizationId: string; clientId: string; year: number },
): Promise<LeaveReportDataset> {
  const { organizationId, clientId, year } = args;
  const { start, end } = yearBounds(year);

  const [client, employees] = await Promise.all([
    tx.outsourcingClient.findUnique({ where: { id: clientId }, select: { name: true, currency: true } }),
    tx.employee.findMany({
      where: { organizationId, outsourcingClientId: clientId, employmentStatus: 'active' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        baseSalary: true,
        costCenterCode: true,
        costCenterName: true,
        department: { select: { name: true } },
        manager: { select: { firstName: true, lastName: true } },
        leaveBalances: {
          where: { year },
          include: { leaveType: { select: { name: true, daysPerYear: true } } },
        },
        leaveApplications: {
          where: { startDate: { gte: start, lte: end } },
          include: { leaveType: { select: { name: true } } },
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
  ]);

  const currency = client?.currency ?? 'KES';

  const people: LeaveReportPerson[] = employees.map((e) => {
    const name = `${e.firstName} ${e.lastName}`.trim();
    const dailyRate = dailyRateFromSalary(e.baseSalary ? Number(e.baseSalary) : 0);

    const balances: LeaveReportBalance[] = e.leaveBalances
      .slice()
      .sort((a, b) => a.leaveType.name.localeCompare(b.leaveType.name))
      .map((b) => {
        const pending = e.leaveApplications
          .filter((a) => a.leaveTypeId === b.leaveTypeId && a.status === 'pending')
          .reduce((s, a) => s + a.days, 0);
        return {
          leaveTypeName: b.leaveType.name,
          color: leaveTypeColor(b.leaveType.name),
          entitled: b.leaveType.daysPerYear,
          used: b.used,
          pending,
          remaining: b.balance,
        };
      });

    const applications: LeaveReportApplication[] = e.leaveApplications.map((a) => ({
      leaveTypeName: a.leaveType.name,
      startDate: iso(a.startDate),
      endDate: iso(a.endDate),
      days: a.days,
      status: a.status,
    }));

    const annualBal = balances.find((b) => /annual/i.test(b.leaveTypeName));
    const annual = annualBal
      ? { entitled: annualBal.entitled, used: annualBal.used, pending: annualBal.pending, remaining: annualBal.remaining }
      : { entitled: 0, used: 0, pending: 0, remaining: 0 };

    const ytdTaken = e.leaveApplications
      .filter((a) => a.status === 'approved')
      .reduce((s, a) => s + a.days, 0);

    const liability: LeaveReportLiabilityRow[] = balances
      .filter((b) => b.remaining > 0)
      .map((b) => ({
        leaveTypeName: b.leaveTypeName,
        remainingDays: b.remaining,
        dailyRate,
        amount: computeLeaveLiability(b.remaining, dailyRate),
      }));
    const liabilityTotal = liability.reduce((s, r) => s + (r.amount ?? 0), 0);

    const managerName = e.manager
      ? `${e.manager.firstName} ${e.manager.lastName}`.trim()
      : null;

    return {
      id: e.id,
      name,
      identifier: e.employeeNumber,
      group: e.department?.name ?? 'Unassigned',
      costCenter: e.costCenterName || e.costCenterCode || null,
      annual,
      ytdTaken,
      balances,
      applications,
      liability,
      liabilityTotal,
      approvers: managerName ? [managerName] : [],
    };
  });

  return {
    audience: 'outsourced',
    title: client?.name ?? 'Outsourced workforce',
    orgName: client?.name ?? 'Outsourced workforce',
    year,
    currency,
    hasMonetaryLiability: true,
    groupLabel: 'Department',
    people,
  };
}

// ————————————————————————————————————————————————————————————————
// Person-detail projection (for the expandable UI)
// ————————————————————————————————————————————————————————————————

export function personToDetail(person: LeaveReportPerson, dataset: LeaveReportDataset) {
  const colorByType = new Map<string, string>();
  for (const b of person.balances) {
    colorByType.set(b.leaveTypeName, b.color || leaveTypeColor(b.leaveTypeName));
  }
  return {
    id: person.id,
    name: person.name,
    subtitle: person.identifier,
    meta: [person.group, person.costCenter].filter(Boolean).join(' · ') || null,
    year: dataset.year,
    annual: person.annual,
    balances: person.balances.map((b, i) => ({
      leaveTypeId: `${person.id}-${i}`,
      name: b.leaveTypeName,
      color: b.color,
      entitled: b.entitled,
      used: b.used,
      pending: b.pending,
      remaining: b.remaining,
    })),
    applications: person.applications.map((a, i) => ({
      id: `${person.id}-app-${i}`,
      leaveTypeName: a.leaveTypeName,
      color: colorByType.get(a.leaveTypeName) ?? leaveTypeColor(a.leaveTypeName),
      startDate: a.startDate,
      endDate: a.endDate,
      days: a.days,
      status: a.status,
    })),
    approvers: person.approvers,
  };
}
