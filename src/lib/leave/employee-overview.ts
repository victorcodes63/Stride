import type { PrismaClient } from '@prisma/client';

const WORKING_DAYS_PER_MONTH = 22;

export type LeaveCalendarEvent = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
};

export type LeaveAccrualRow = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  leaveTypeName: string;
  entitledDays: number;
  usedDays: number;
  remainingDays: number;
  accrualMode: string;
};

export type LeaveLiabilityRow = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  leaveTypeName: string;
  remainingDays: number;
  dailyRate: number;
  liabilityAmount: number;
};

export type EmployeeLeaveOverview = {
  year: number;
  month: number;
  calendar: LeaveCalendarEvent[];
  accrual: LeaveAccrualRow[];
  liability: {
    totalAmount: number;
    currency: string;
    rows: LeaveLiabilityRow[];
  };
  kpis: {
    pendingApplications: number;
    onLeaveThisMonth: number;
    totalRemainingDays: number;
  };
};

export function dailyRateFromSalary(baseSalary: number | null | undefined): number {
  const salary = Number(baseSalary ?? 0);
  if (salary <= 0) return 0;
  return Math.round((salary / WORKING_DAYS_PER_MONTH) * 100) / 100;
}

export function computeLeaveLiability(remainingDays: number, dailyRate: number): number {
  return Math.round(remainingDays * dailyRate * 100) / 100;
}

export async function buildEmployeeLeaveOverview(
  prisma: PrismaClient,
  input: { clientId: string; year: number; month: number },
): Promise<EmployeeLeaveOverview> {
  const { clientId, year, month } = input;
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const client = await prisma.outsourcingClient.findUnique({
    where: { id: clientId },
    select: { currency: true },
  });
  const currency = client?.currency ?? 'KES';

  const [applications, balances, pendingCount] = await Promise.all([
    prisma.leaveApplication.findMany({
      where: {
        employee: { outsourcingClientId: clientId, employmentStatus: 'active' },
        status: { in: ['pending', 'approved'] },
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      include: {
        leaveType: { select: { name: true } },
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { startDate: 'asc' },
    }),
    prisma.leaveBalance.findMany({
      where: {
        year,
        employee: { outsourcingClientId: clientId, employmentStatus: 'active' },
      },
      include: {
        leaveType: { select: { name: true, daysPerYear: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            baseSalary: true,
          },
        },
      },
      orderBy: [{ employee: { lastName: 'asc' } }, { leaveType: { name: 'asc' } }],
    }),
    prisma.leaveApplication.count({
      where: {
        employee: { outsourcingClientId: clientId },
        status: 'pending',
      },
    }),
  ]);

  const policyAssignments = await prisma.leavePolicyAssignment.findMany({
    where: {
      employee: { outsourcingClientId: clientId, employmentStatus: 'active' },
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    include: {
      leavePolicy: {
        include: { rules: { include: { leaveType: true } } },
      },
    },
  });

  const accrualModeByEmployeeType = new Map<string, string>();
  for (const assignment of policyAssignments) {
    for (const rule of assignment.leavePolicy.rules) {
      accrualModeByEmployeeType.set(
        `${assignment.employeeId}:${rule.leaveTypeId}`,
        rule.accrualMode,
      );
    }
  }

  const calendar: LeaveCalendarEvent[] = applications.map((app) => ({
    id: app.id,
    employeeId: app.employeeId,
    employeeName: `${app.employee.firstName} ${app.employee.lastName}`.trim(),
    leaveTypeName: app.leaveType.name,
    startDate: app.startDate.toISOString().slice(0, 10),
    endDate: app.endDate.toISOString().slice(0, 10),
    days: app.days,
    status: app.status,
  }));

  const accrual: LeaveAccrualRow[] = balances.map((b) => {
    const entitled = b.leaveType.daysPerYear;
    const remaining = b.balance;
    const used = b.used;
    const mode =
      accrualModeByEmployeeType.get(`${b.employeeId}:${b.leaveTypeId}`) ?? 'monthly_accrual';
    return {
      employeeId: b.employeeId,
      employeeName: `${b.employee.firstName} ${b.employee.lastName}`.trim(),
      employeeNumber: b.employee.employeeNumber,
      leaveTypeName: b.leaveType.name,
      entitledDays: entitled,
      usedDays: used,
      remainingDays: remaining,
      accrualMode: mode,
    };
  });

  const liabilityRows: LeaveLiabilityRow[] = balances
    .filter((b) => b.balance > 0)
    .map((b) => {
      const dailyRate = dailyRateFromSalary(b.employee.baseSalary ? Number(b.employee.baseSalary) : 0);
      const liabilityAmount = computeLeaveLiability(b.balance, dailyRate);
      return {
        employeeId: b.employeeId,
        employeeName: `${b.employee.firstName} ${b.employee.lastName}`.trim(),
        employeeNumber: b.employee.employeeNumber,
        leaveTypeName: b.leaveType.name,
        remainingDays: b.balance,
        dailyRate,
        liabilityAmount,
      };
    })
    .sort((a, b) => b.liabilityAmount - a.liabilityAmount);

  const totalAmount = liabilityRows.reduce((sum, row) => sum + row.liabilityAmount, 0);
  const onLeaveThisMonth = calendar.filter((c) => c.status === 'approved').length;
  const totalRemainingDays = balances.reduce((sum, b) => sum + b.balance, 0);

  return {
    year,
    month,
    calendar,
    accrual,
    liability: { totalAmount, currency, rows: liabilityRows },
    kpis: {
      pendingApplications: pendingCount,
      onLeaveThisMonth,
      totalRemainingDays,
    },
  };
}
