import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toCSV } from '@/lib/report-export';
import { downloadHeaders, jsonOrPdf, parseDateParam, parseFormat, requireReportsUser, startOfDayUtc, ymd } from '@/app/api/reports/_shared';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

type GroupCount = { [key: string]: number };

const CLINICAL_KEYWORDS = [
  'nurse',
  'doctor',
  'clinical',
  'pharmac',
  'lab',
  'radiology',
  'theatre',
  'anesth',
  'midwife',
];

function isClinical(department: string | null, jobTitle: string | null): boolean {
  const needle = `${department ?? ''} ${jobTitle ?? ''}`.toLowerCase();
  return CLINICAL_KEYWORDS.some((k) => needle.includes(k));
}

function addCount(map: GroupCount, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export async function GET(request: NextRequest) {
  const auth = await requireReportsUser(request);
  if (!auth.ok) return auth.response;
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });

  const asOf = parseDateParam(request.nextUrl.searchParams.get('asOf'), new Date());
  const asOfDay = startOfDayUtc(asOf);
  const thirtyDaysAgo = new Date(asOfDay.getTime() - 30 * 24 * 60 * 60 * 1000);
  const format = parseFormat(request);
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const employees = await prisma.employee.findMany({
    where: {
      outsourcingClientId: workspaceClientId,
      createdAt: { lte: asOfDay },
    },
    select: {
      id: true,
      createdAt: true,
      employmentStatus: true,
      employmentEndedAt: true,
      department: { select: { name: true } },
      jobTitle: true,
    },
  });

  const activeEmployees = employees.filter((e) => e.employmentStatus !== 'terminated');
  const byDept = new Map<string, { department: string; count: number; clinical: number; nonClinical: number }>();
  const byContractType: GroupCount = {};
  const byGender: GroupCount = {};
  let clinical = 0;
  let nonClinical = 0;

  for (const employee of activeEmployees) {
    const department = employee.department?.name ?? 'Unassigned';
    const contractType = employee.employmentStatus ?? 'unknown';
    const employeeClinical = isClinical(department, employee.jobTitle);

    if (employeeClinical) clinical += 1;
    else nonClinical += 1;

    const current = byDept.get(department) ?? { department, count: 0, clinical: 0, nonClinical: 0 };
    current.count += 1;
    if (employeeClinical) current.clinical += 1;
    else current.nonClinical += 1;
    byDept.set(department, current);

    addCount(byContractType, contractType);
  }
  byGender.unspecified = activeEmployees.length;

  const newHires = employees.filter((e) => e.createdAt >= thirtyDaysAgo && e.createdAt <= asOfDay).length;
  const terminations = employees.filter((e) => e.employmentEndedAt && e.employmentEndedAt >= thirtyDaysAgo && e.employmentEndedAt <= asOfDay).length;

  const report = {
    totalEmployees: activeEmployees.length,
    clinical,
    nonClinical,
    byDepartment: Array.from(byDept.values()).sort((a, b) => b.count - a.count),
    byContractType: Object.entries(byContractType).map(([type, count]) => ({ type, count })),
    byGender: Object.entries(byGender).map(([gender, count]) => ({ gender, count })),
    newHires,
    terminations,
  };

  if (format === 'csv') {
    const csv = toCSV(
      ['Department', 'Total', 'Clinical', 'Non-Clinical'],
      report.byDepartment.map((row) => [row.department, row.count, row.clinical, row.nonClinical])
    );
    return new NextResponse(csv, {
      headers: downloadHeaders('text/csv', `headcount-${ymd(asOfDay)}.csv`),
    });
  }

  return jsonOrPdf(
    format,
    report,
    'Headcount Report',
    `headcount-${ymd(asOfDay)}.pdf`,
    [
      `As of: ${ymd(asOfDay)}`,
      `Total employees: ${report.totalEmployees}`,
      `Clinical: ${report.clinical}`,
      `Non-clinical: ${report.nonClinical}`,
      `New hires (30d): ${report.newHires}`,
      `Terminations (30d): ${report.terminations}`,
    ]
  );
}
