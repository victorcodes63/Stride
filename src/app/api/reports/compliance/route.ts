import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCSV } from '@/lib/report-export';
import { downloadHeaders, jsonOrPdf, parseFormat, requireReportsUser, ymd } from '@/app/api/reports/_shared';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function GET(request: NextRequest) {
  const auth = await requireReportsUser(request);
  if (!auth.ok) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const format = parseFormat(request);
  const now = new Date();
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const employeeWhere = { outsourcingClientId: workspaceClientId };

  const [disciplinaryCases, grievances, onboardingWorkflows] = await Promise.all([
    prisma.disciplinaryCase.findMany({
      where: { employee: employeeWhere },
      include: {
        employee: {
          select: { firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
      orderBy: { incidentDate: 'desc' },
      take: 500,
    }),
    prisma.grievance.findMany({
      where: { employee: employeeWhere },
      include: {
        employee: {
          select: { firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 500,
    }),
    prisma.onboardingWorkflow.findMany({
      where: { employee: employeeWhere },
      include: {
        employee: {
          select: { firstName: true, lastName: true, department: { select: { name: true } } },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 500,
    }),
  ]);

  const openCases = disciplinaryCases.filter((c) =>
    ['OPEN', 'UNDER_INVESTIGATION', 'HEARING_SCHEDULED', 'AWAITING_RESPONSE', 'ESCALATED'].includes(c.status),
  ).length;
  const openGrievances = grievances.filter((g) =>
    ['SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATING', 'ESCALATED'].includes(g.status),
  ).length;
  const activeOnboarding = onboardingWorkflows.filter((w) => w.status === 'IN_PROGRESS').length;

  const details = [
    ...disciplinaryCases.map((row) => ({
      category: 'Disciplinary',
      reference: row.caseNumber,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      department: row.employee.department?.name ?? 'Unassigned',
      status: row.status,
      severity: row.severity,
      date: ymd(row.incidentDate),
    })),
    ...grievances.map((row) => ({
      category: 'Grievance',
      reference: row.grievanceNumber,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      department: row.employee.department?.name ?? 'Unassigned',
      status: row.status,
      severity: row.category,
      date: ymd(row.submittedAt),
    })),
    ...onboardingWorkflows.map((row) => ({
      category: row.type === 'OFFBOARDING' ? 'Offboarding' : 'Onboarding',
      reference: row.id.slice(0, 8),
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      department: row.employee.department?.name ?? 'Unassigned',
      status: row.status,
      severity: '—',
      date: ymd(row.startedAt),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const report = {
    generatedAt: ymd(now),
    openDisciplinaryCases: openCases,
    openGrievances,
    activeOnboarding,
    totalDisciplinary: disciplinaryCases.length,
    totalGrievances: grievances.length,
    totalWorkflows: onboardingWorkflows.length,
    details,
  };

  if (format === 'csv') {
    const csv = toCSV(
      ['Category', 'Reference', 'Employee', 'Department', 'Status', 'Priority/Severity', 'Date'],
      report.details.map((row) => [
        row.category,
        row.reference,
        row.employeeName,
        row.department,
        row.status,
        row.severity,
        row.date,
      ]),
    );
    return new NextResponse(csv, {
      headers: downloadHeaders('text/csv', `compliance-${ymd(now)}.csv`),
    });
  }

  return jsonOrPdf(format, report, 'Compliance Report', `compliance-${ymd(now)}.pdf`, [
    `Generated: ${report.generatedAt}`,
    `Open disciplinary cases: ${report.openDisciplinaryCases}`,
    `Open grievances: ${report.openGrievances}`,
    `Active onboarding/offboarding: ${report.activeOnboarding}`,
  ]);
}
