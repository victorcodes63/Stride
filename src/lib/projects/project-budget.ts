import type { PrismaClient } from '@prisma/client';

export type ProjectBudgetActuals = {
  payroll: number;
  accountsPayable: number;
  expenses: number;
};

export type ProjectBudgetReport = {
  projectId: string;
  projectCode: string;
  projectName: string;
  currency: string;
  department: string | null;
  periodStart: string;
  periodEnd: string;
  budget: {
    id: string | null;
    name: string | null;
    allocated: number;
    financeSpent: number | null;
  };
  actuals: ProjectBudgetActuals;
  totalActual: number;
  remaining: number;
  utilizationPercent: number;
  burnRateMonthly: number | null;
};

type Db = Pick<
  PrismaClient,
  | 'project'
  | 'budget'
  | 'payroll'
  | 'employee'
  | 'department'
  | 'purchaseOrder'
  | 'expenseClaim'
>;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function normalizeDept(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

export function deptMatches(projectDept: string | null | undefined, other: string | null | undefined) {
  const a = normalizeDept(projectDept);
  if (!a) return false;
  return a === normalizeDept(other);
}

export function resolveProjectPeriod(
  startDate: Date | null | undefined,
  dueDate: Date | null | undefined,
  now = new Date(),
): { start: Date; end: Date } {
  const year = now.getFullYear();
  const start = startDate ?? new Date(`${year}-01-01`);
  const end = dueDate && dueDate < now ? dueDate : now;
  return { start, end };
}

export function monthInRange(year: number, month: number, start: Date, end: Date) {
  const d = new Date(year, month - 1, 1);
  const periodStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const periodEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
  return d >= periodStart && d <= periodEnd;
}

export function sumActuals(actuals: ProjectBudgetActuals) {
  return round2(actuals.payroll + actuals.accountsPayable + actuals.expenses);
}

export async function buildProjectBudgetReport(
  db: Db,
  params: { projectId: string; outsourcingClientId: string },
): Promise<ProjectBudgetReport | null> {
  const project = await db.project.findFirst({
    where: { id: params.projectId, outsourcingClientId: params.outsourcingClientId },
    include: {
      budget: { select: { id: true, name: true, allocatedAmount: true, spentAmount: true, currency: true } },
    },
  });
  if (!project) return null;

  const { start, end } = resolveProjectPeriod(project.startDate, project.dueDate);
  const dept = project.department;

  const departments = await db.department.findMany({
    where: { outsourcingClientId: params.outsourcingClientId },
    select: { id: true, name: true },
  });
  const deptIds = departments.filter((d) => deptMatches(dept, d.name)).map((d) => d.id);

  let payrollTotal = 0;
  if (deptIds.length > 0) {
    const employees = await db.employee.findMany({
      where: { outsourcingClientId: params.outsourcingClientId, departmentId: { in: deptIds } },
      select: { id: true },
    });
    const employeeIds = employees.map((e) => e.id);
    if (employeeIds.length > 0) {
      const payrollRows = await db.payroll.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: { in: ['approved', 'paid'] },
        },
        select: { year: true, month: true, grossPay: true },
      });
      for (const row of payrollRows) {
        if (monthInRange(row.year, row.month, start, end)) {
          payrollTotal += Number(row.grossPay);
        }
      }
    }
  }

  const orders = await db.purchaseOrder.findMany({
    where: {
      outsourcingClientId: params.outsourcingClientId,
      status: { in: ['issued', 'fulfilled'] },
      createdAt: { gte: start, lte: end },
    },
    include: {
      purchaseRequest: { select: { department: true } },
      vendorBill: { select: { lines: { select: { amountExVat: true } }, vatRateBps: true } },
    },
  });

  let apTotal = 0;
  for (const order of orders) {
    if (!deptMatches(dept, order.purchaseRequest?.department)) continue;
    if (order.vendorBill?.lines?.length) {
      const subtotal = order.vendorBill.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
      const vat = Math.round(subtotal * (order.vendorBill.vatRateBps / 10000) * 100) / 100;
      apTotal += subtotal + vat;
    } else {
      apTotal += Number(order.totalAmount);
    }
  }

  const expenseRows = await db.expenseClaim.findMany({
    where: {
      status: { in: ['approved', 'reimbursed'] },
      submittedAt: { gte: start, lte: end },
    },
    select: { department: true, totalAmount: true },
  });
  let expenseTotal = 0;
  for (const claim of expenseRows) {
    if (deptMatches(dept, claim.department)) {
      expenseTotal += Number(claim.totalAmount);
    }
  }

  const actuals: ProjectBudgetActuals = {
    payroll: round2(payrollTotal),
    accountsPayable: round2(apTotal),
    expenses: round2(expenseTotal),
  };
  const totalActual = sumActuals(actuals);

  const allocatedFromBudget = project.budget ? Number(project.budget.allocatedAmount) : null;
  const allocated =
    allocatedFromBudget ??
    (project.budgetAmount != null ? Number(project.budgetAmount) : 0);

  const remaining = round2(allocated - totalActual);
  const utilizationPercent =
    allocated > 0 ? round2((totalActual / allocated) * 100) : 0;

  const monthsElapsed = Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1,
  );
  const burnRateMonthly = allocated > 0 ? round2(totalActual / monthsElapsed) : null;

  return {
    projectId: project.id,
    projectCode: project.projectCode,
    projectName: project.name,
    currency: project.budget?.currency ?? project.currency,
    department: project.department,
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    budget: {
      id: project.budget?.id ?? null,
      name: project.budget?.name ?? null,
      allocated: round2(allocated),
      financeSpent: project.budget ? Number(project.budget.spentAmount) : null,
    },
    actuals,
    totalActual,
    remaining,
    utilizationPercent,
    burnRateMonthly,
  };
}
