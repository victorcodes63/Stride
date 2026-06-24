import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canWriteRota } from '@/lib/rota/api-auth';
import { buildInstantsFromImportRow, parseRotaImportCsv } from '@/lib/rota/import-adapter';
import { normalizeEmployeeNationalId } from '@/lib/outsourcing-employee-national-id';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWriteRota(user)) {
    return NextResponse.json({ error: 'Viewers cannot import' }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const requestedClientId = String(formData.get('clientId') ?? '').trim();
  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);

  const client = await prisma.outsourcingClient.findUnique({ where: { id: clientId } });
  if (!client) return NextResponse.json({ error: 'Primary workspace not found' }, { status: 404 });

  const text = await file.text();
  const { rows, errors, headers } = parseRotaImportCsv(text);
  if (errors.length && !rows.length) {
    return NextResponse.json({ ok: false, parseErrors: errors, headers, rows: [] });
  }

  const templates = await prisma.shiftTemplate.findMany({
    where: { outsourcingClientId: clientId, isActive: true },
  });
  const byName = new Map(templates.map((t) => [t.name.toLowerCase().trim(), t]));

  const employees = await prisma.employee.findMany({
    where: { outsourcingClientId: clientId },
    select: { id: true, firstName: true, lastName: true, employeeNumber: true, idNumber: true },
  });
  const byEmployeeNumber = new Map(
    employees
      .filter((e) => e.employeeNumber)
      .map((e) => [e.employeeNumber!.toLowerCase().trim(), e] as const),
  );
  const byNat = new Map(
    employees
      .map((e) => {
        const k = normalizeEmployeeNationalId(e.idNumber);
        return k ? ([k, e] as const) : null;
      })
      .filter((x): x is [string, (typeof employees)[0]] => x != null),
  );

  const rowsOut: {
    row: number;
    employeeNumber: string;
    workDate: string;
    employeeId: string | null;
    matchReason?: string;
    templateId: string | null;
    startsAt: string | null;
    endsAt: string | null;
    breakMinutes: number;
    error?: string;
  }[] = [];

  for (const r of rows) {
    const key = r.employeeNumber.toLowerCase().trim();
    let emp = byEmployeeNumber.get(key);
    let matchReason: string | undefined;
    if (!emp) {
      const n = byNat.get(normalizeEmployeeNationalId(r.employeeNumber) ?? '');
      if (n) {
        emp = n;
        matchReason = 'nationalId';
      }
    } else {
      matchReason = 'employeeNumber';
    }
    if (!emp) {
      rowsOut.push({
        row: r.row,
        employeeNumber: r.employeeNumber,
        workDate: r.workDate,
        employeeId: null,
        templateId: null,
        startsAt: null,
        endsAt: null,
        breakMinutes: r.breakMinutes,
        error: 'Employee not found (EMP No. or National ID for this workspace)',
      });
      continue;
    }

    if (r.shiftTemplateName) {
      const t = byName.get(r.shiftTemplateName.toLowerCase().trim());
      if (!t) {
        rowsOut.push({
          row: r.row,
          employeeNumber: r.employeeNumber,
          workDate: r.workDate,
          employeeId: emp.id,
          matchReason,
          templateId: null,
          startsAt: null,
          endsAt: null,
          breakMinutes: r.breakMinutes,
          error: `Template "${r.shiftTemplateName}" not found`,
        });
        continue;
      }
      let inst: { startsAt: Date; endsAt: Date };
      try {
        inst = buildInstantsFromImportRow(r, t);
      } catch (e) {
        rowsOut.push({
          row: r.row,
          employeeNumber: r.employeeNumber,
          workDate: r.workDate,
          employeeId: emp.id,
          matchReason,
          templateId: t.id,
          startsAt: null,
          endsAt: null,
          breakMinutes: r.breakMinutes,
          error: e instanceof Error ? e.message : 'Invalid times',
        });
        continue;
      }
      const br = r.breakMinutes > 0 ? r.breakMinutes : t.breakMinutes;
      rowsOut.push({
        row: r.row,
        employeeNumber: r.employeeNumber,
        workDate: r.workDate,
        employeeId: emp.id,
        matchReason,
        templateId: t.id,
        startsAt: inst.startsAt.toISOString(),
        endsAt: inst.endsAt.toISOString(),
        breakMinutes: br,
      });
    } else {
      let inst: { startsAt: Date; endsAt: Date };
      try {
        inst = buildInstantsFromImportRow(r, { startMinutes: 0, endMinutes: 0 });
      } catch (e) {
        rowsOut.push({
          row: r.row,
          employeeNumber: r.employeeNumber,
          workDate: r.workDate,
          employeeId: emp.id,
          matchReason,
          templateId: null,
          startsAt: null,
          endsAt: null,
          breakMinutes: r.breakMinutes,
          error: e instanceof Error ? e.message : 'Invalid times',
        });
        continue;
      }
      rowsOut.push({
        row: r.row,
        employeeNumber: r.employeeNumber,
        workDate: r.workDate,
        employeeId: emp.id,
        matchReason,
        templateId: null,
        startsAt: inst.startsAt.toISOString(),
        endsAt: inst.endsAt.toISOString(),
        breakMinutes: r.breakMinutes,
      });
    }
  }

  return NextResponse.json({ ok: true, headers, parseErrors: errors, rows: rowsOut });
}
