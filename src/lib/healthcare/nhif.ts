import type { PrismaClient } from '@prisma/client';

export async function buildNhifOverview(db: PrismaClient, outsourcingClientId: string) {
  const [client, employees, payrollRows] = await Promise.all([
    db.outsourcingClient.findUnique({
      where: { id: outsourcingClientId },
      select: { nhifEmployerNumber: true, name: true },
    }),
    db.employee.findMany({
      where: { outsourcingClientId, employmentStatus: 'active' },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        nhifNumber: true,
        jobTitle: true,
      },
      orderBy: { employeeNumber: 'asc' },
    }),
    db.payroll.findMany({
      where: { employee: { outsourcingClientId } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 200,
      select: {
        employeeId: true,
        month: true,
        year: true,
        grossPay: true,
        nhif: true,
      },
    }),
  ]);

  const withNhif = employees.filter((e) => e.nhifNumber?.trim());
  const missing = employees.filter((e) => !e.nhifNumber?.trim());

  return {
    employer: {
      name: client?.name ?? null,
      nhifEmployerNumber: client?.nhifEmployerNumber ?? null,
      employerRegistered: Boolean(client?.nhifEmployerNumber?.trim()),
    },
    employees: {
      total: employees.length,
      withNhifNumber: withNhif.length,
      missingNhifNumber: missing.length,
      compliancePct:
        employees.length === 0 ? 100 : Math.round((withNhif.length / employees.length) * 100),
    },
    missing: missing.map((e) => ({
      id: e.id,
      employeeNumber: e.employeeNumber,
      name: `${e.firstName} ${e.lastName}`.trim(),
      jobTitle: e.jobTitle,
    })),
    latestPayrollShif: payrollRows.slice(0, 5).map((p) => ({
      employeeId: p.employeeId,
      period: `${p.year}-${String(p.month).padStart(2, '0')}`,
      grossPay: Number(p.grossPay),
      shifDeduction: Number(p.nhif),
    })),
  };
}

export async function buildNhifReturnExtract(
  db: PrismaClient,
  outsourcingClientId: string,
  yearMonth: string,
) {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) throw new Error('yearMonth must be YYYY-MM');

  const client = await db.outsourcingClient.findUnique({
    where: { id: outsourcingClientId },
    select: { nhifEmployerNumber: true, name: true },
  });

  const payroll = await db.payroll.findMany({
    where: {
      employee: { outsourcingClientId },
      year: y,
      month: m,
    },
    include: {
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
          nhifNumber: true,
          idNumber: true,
        },
      },
    },
    orderBy: { employee: { employeeNumber: 'asc' } },
  });

  return {
    template: 'NHIF/SHIF monthly return (illustrative)',
    period: { year: y, month: m },
    employerNumber: client?.nhifEmployerNumber ?? null,
    employerName: client?.name ?? null,
    rows: payroll.map((p) => ({
      employeeNumber: p.employee.employeeNumber,
      name: `${p.employee.firstName} ${p.employee.lastName}`.trim(),
      nationalId: p.employee.idNumber,
      nhifNumber: p.employee.nhifNumber,
      grossPay: Number(p.grossPay),
      shifDeduction: Number(p.nhif),
    })),
    totals: {
      headcount: payroll.length,
      grossPay: payroll.reduce((s, p) => s + Number(p.grossPay), 0),
      shif: payroll.reduce((s, p) => s + Number(p.nhif), 0),
    },
  };
}
