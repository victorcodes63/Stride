import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCSV } from '@/lib/report-export';
import { downloadHeaders, jsonOrPdf, parseDateParam, parseFormat, requireReportsUser, startOfDayUtc, ymd } from '@/app/api/reports/_shared';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

type EmployeeRollup = {
  name: string;
  department: string;
  hoursWorked: number;
  overtimeHours: number;
  lateCount: number;
  absentCount: number;
};

type DepartmentRollup = {
  department: string;
  hoursWorked: number;
  overtimeHours: number;
  lateCount: number;
};

export async function GET(request: NextRequest) {
  const auth = await requireReportsUser(request);
  if (!auth.ok) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const from = startOfDayUtc(parseDateParam(request.nextUrl.searchParams.get('from'), defaultFrom));
  const to = startOfDayUtc(parseDateParam(request.nextUrl.searchParams.get('to'), now));
  const format = parseFormat(request);
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const [scheduled, summaries, exceptions] = await Promise.all([
    prisma.shiftAssignment.count({
      where: {
        workDate: { gte: from, lte: to },
        employee: { outsourcingClientId: workspaceClientId },
      },
    }),
    prisma.attendanceDaySummary.findMany({
      where: {
        outsourcingClientId: workspaceClientId,
        workDate: { gte: from, lte: to },
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
    prisma.attendanceException.findMany({
      where: {
        employee: { outsourcingClientId: workspaceClientId },
        workDate: { gte: from, lte: to },
        type: { in: ['late_arrival', 'missing_check_out'] },
      },
      select: { type: true, status: true },
    }),
  ]);

  const employeeMap = new Map<string, EmployeeRollup>();
  const departmentMap = new Map<string, DepartmentRollup>();
  let totalMinutes = 0;
  let totalOvertimeMinutes = 0;
  let totalShiftsWorked = 0;
  let lateArrivals = 0;
  let absentDays = 0;

  for (const row of summaries) {
    const name = `${row.employee.firstName} ${row.employee.lastName}`.trim();
    const department = row.employee.department?.name ?? 'Unassigned';
    const key = `${name}::${department}`;
    const employee = employeeMap.get(key) ?? {
      name,
      department,
      hoursWorked: 0,
      overtimeHours: 0,
      lateCount: 0,
      absentCount: 0,
    };
    const departmentRollup = departmentMap.get(department) ?? {
      department,
      hoursWorked: 0,
      overtimeHours: 0,
      lateCount: 0,
    };

    totalMinutes += row.minutesWorked;
    totalOvertimeMinutes += row.overtimeMinutes;
    if (row.minutesWorked > 0) totalShiftsWorked += 1;

    employee.hoursWorked += toHours(row.minutesWorked);
    employee.overtimeHours += toHours(row.overtimeMinutes);
    if (row.lateMinutes > 0) {
      employee.lateCount += 1;
      departmentRollup.lateCount += 1;
      lateArrivals += 1;
    }
    if (row.minutesWorked === 0) {
      employee.absentCount += 1;
      absentDays += 1;
    }

    departmentRollup.hoursWorked += toHours(row.minutesWorked);
    departmentRollup.overtimeHours += toHours(row.overtimeMinutes);

    employeeMap.set(key, employee);
    departmentMap.set(department, departmentRollup);
  }

  const missedClockOuts = exceptions.filter((e) => e.type === 'missing_check_out' && e.status === 'open').length;

  const report = {
    totalShiftsScheduled: scheduled,
    totalShiftsWorked,
    totalHours: Math.round(toHours(totalMinutes) * 100) / 100,
    totalOvertimeHours: Math.round(toHours(totalOvertimeMinutes) * 100) / 100,
    lateArrivals,
    missedClockOuts,
    absentDays,
    byDepartment: Array.from(departmentMap.values()).sort((a, b) => b.hoursWorked - a.hoursWorked),
    byEmployee: Array.from(employeeMap.values()).sort((a, b) => b.hoursWorked - a.hoursWorked),
  };

  if (format === 'csv') {
    const csv = toCSV(
      ['Employee', 'Department', 'Hours Worked', 'Overtime Hours', 'Late Count', 'Absent Count'],
      report.byEmployee.map((row) => [
        row.name,
        row.department,
        row.hoursWorked.toFixed(2),
        row.overtimeHours.toFixed(2),
        row.lateCount,
        row.absentCount,
      ])
    );
    return new NextResponse(csv, {
      headers: downloadHeaders('text/csv', `attendance-${ymd(from)}-to-${ymd(to)}.csv`),
    });
  }

  return jsonOrPdf(
    format,
    report,
    'Attendance Summary Report',
    `attendance-${ymd(from)}-to-${ymd(to)}.pdf`,
    [
      `From: ${ymd(from)} To: ${ymd(to)}`,
      `Shifts scheduled: ${report.totalShiftsScheduled}`,
      `Shifts worked: ${report.totalShiftsWorked}`,
      `Hours worked: ${report.totalHours}`,
      `Overtime hours: ${report.totalOvertimeHours}`,
      `Late arrivals: ${report.lateArrivals}`,
      `Missed clock-outs: ${report.missedClockOuts}`,
    ]
  );
}
