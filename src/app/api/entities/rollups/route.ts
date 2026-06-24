import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { allEntityIds, parseEntityScope } from '@/lib/entity-request';
import { logAuditEvent } from '@/lib/audit-events';

function asMoney(value: unknown): number {
  return Number(value ?? 0);
}

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.staffUserType !== 'finance' && user.staffUserType !== 'business_manager') {
    return forbiddenResponse('Entity rollups require admin, finance, or business manager access.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const now = new Date();
  const month = Number(request.nextUrl.searchParams.get('month') ?? now.getUTCMonth() + 1);
  const year = Number(request.nextUrl.searchParams.get('year') ?? now.getUTCFullYear());
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
    return NextResponse.json({ error: 'Invalid month/year values.' }, { status: 400 });
  }

  const scope = await parseEntityScope(request.nextUrl.searchParams.get('scope'));
  const entityCodes = scope === 'all' ? await allEntityIds() : [scope];
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));

  const [clients, employeeRows, payrollRows, leaveRows, statutoryRows] = await Promise.all([
    prisma.outsourcingClient.findMany({
      where: { entityCode: { in: entityCodes } },
      select: { id: true, entityCode: true, name: true },
    }),
    prisma.employee.findMany({
      where: { client: { entityCode: { in: entityCodes } }, employmentStatus: { not: 'terminated' } },
      select: { id: true, outsourcingClientId: true },
    }),
    prisma.payroll.findMany({
      where: { year, month, employee: { client: { entityCode: { in: entityCodes } } } },
      select: { employeeId: true, grossPay: true, netPay: true, paye: true, nssf: true, nhif: true, ahl: true },
    }),
    prisma.leaveApplication.findMany({
      where: {
        status: 'approved',
        startDate: { gte: periodStart, lt: periodEnd },
        employee: { client: { entityCode: { in: entityCodes } } },
      },
      select: { employeeId: true, days: true },
    }),
    prisma.statutoryReturn.findMany({
      where: { year, month, client: { entityCode: { in: entityCodes } } },
      select: {
        outsourcingClientId: true,
        totalPaye: true,
        totalNssfEmployee: true,
        totalNssfEmployer: true,
        totalShif: true,
        totalAhlEmployee: true,
        totalAhlEmployer: true,
        status: true,
      },
    }),
  ]);

  const clientEntity = new Map(clients.map((client) => [client.id, (client.entityCode ?? 'ke').toLowerCase()]));
  const employeeEntity = new Map(
    employeeRows.map((employee) => [employee.id, clientEntity.get(employee.outsourcingClientId) ?? 'ke']),
  );

  const byEntity = new Map<string, {
    headcount: number;
    payrollGross: number;
    payrollNet: number;
    leaveDays: number;
    leaveApplications: number;
    complianceLiability: number;
    complianceReturns: number;
  }>();
  for (const entity of entityCodes) {
    byEntity.set(entity, {
      headcount: 0,
      payrollGross: 0,
      payrollNet: 0,
      leaveDays: 0,
      leaveApplications: 0,
      complianceLiability: 0,
      complianceReturns: 0,
    });
  }

  for (const employee of employeeRows) {
    const entity = employeeEntity.get(employee.id);
    if (!entity) continue;
    const row = byEntity.get(entity);
    if (row) row.headcount += 1;
  }
  for (const payroll of payrollRows) {
    const entity = employeeEntity.get(payroll.employeeId);
    const row = entity ? byEntity.get(entity) : null;
    if (!row) continue;
    row.payrollGross += asMoney(payroll.grossPay);
    row.payrollNet += asMoney(payroll.netPay);
  }
  for (const leave of leaveRows) {
    const entity = employeeEntity.get(leave.employeeId);
    const row = entity ? byEntity.get(entity) : null;
    if (!row) continue;
    row.leaveApplications += 1;
    row.leaveDays += leave.days;
  }
  for (const statutory of statutoryRows) {
    const entity = clientEntity.get(statutory.outsourcingClientId);
    const row = entity ? byEntity.get(entity) : null;
    if (!row) continue;
    row.complianceReturns += 1;
    row.complianceLiability +=
      asMoney(statutory.totalPaye) +
      asMoney(statutory.totalNssfEmployee) +
      asMoney(statutory.totalNssfEmployer) +
      asMoney(statutory.totalShif) +
      asMoney(statutory.totalAhlEmployee) +
      asMoney(statutory.totalAhlEmployer);
  }

  const rollups = entityCodes.map((entityCode) => ({
    entityCode,
    ...byEntity.get(entityCode)!,
  }));

  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'entity.rollups.view',
    entityType: 'EntityRollup',
    entityId: `${year}-${month}-${scope}`,
    route: 'GET /api/entities/rollups',
    metadata: { scope, month, year, entities: entityCodes },
  });

  return NextResponse.json({ scope, month, year, rollups });
}
