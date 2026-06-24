import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canWriteRota } from '@/lib/rota/api-auth';
import { buildInstantsFromImportRow, parseRotaImportCsv } from '@/lib/rota/import-adapter';
import { normalizeEmployeeNationalId } from '@/lib/outsourcing-employee-national-id';
import { resolveRotaPolicy } from '@/lib/rota/conflict-rules';
import { assertWorkDateInRota, toShiftWindows, conflictsForProposed } from '@/lib/rota/assignment-helpers';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

async function loadNeighborAssignments(employeeId: string, center: Date) {
  const from = new Date(center);
  from.setDate(from.getDate() - 35);
  const to = new Date(center);
  to.setDate(to.getDate() + 35);
  return prisma.shiftAssignment.findMany({
    where: { employeeId, startsAt: { gte: from, lte: to } },
  });
}

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
  const rotaPeriodId = String(formData.get('rotaPeriodId') ?? '').trim();
  if (!file || !rotaPeriodId) {
    return NextResponse.json({ error: 'file and rotaPeriodId are required' }, { status: 400 });
  }
  const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);

  const rota = await prisma.rotaPeriod.findUnique({ where: { id: rotaPeriodId } });
  if (!rota) return NextResponse.json({ error: 'Rota period not found' }, { status: 404 });
  if (rota.outsourcingClientId !== clientId) {
    return NextResponse.json({ error: 'Rota period does not match client' }, { status: 400 });
  }

  const text = await file.text();
  const { rows, errors } = parseRotaImportCsv(text);
  if (errors.length && !rows.length) {
    return NextResponse.json({ ok: false, parseErrors: errors, created: 0, skipped: [] });
  }

  const templates = await prisma.shiftTemplate.findMany({
    where: { outsourcingClientId: clientId, isActive: true },
  });
  const byName = new Map(templates.map((t) => [t.name.toLowerCase().trim(), t]));

  const employees = await prisma.employee.findMany({
    where: { outsourcingClientId: clientId },
    select: { id: true, employeeNumber: true, idNumber: true, jobTitle: true },
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

  const skipped: { row: number; reason: string }[] = [];
  let created = 0;
  /** In-file created assignments for the same import (per employee) for conflict checking. */
  const pendingByEmployee = new Map<string, { id: string; startsAt: Date; endsAt: Date; breakMinutes: number }[]>();

  for (const r of rows) {
    const key = r.employeeNumber.toLowerCase().trim();
    let emp = byEmployeeNumber.get(key);
    if (!emp) {
      const n = byNat.get(normalizeEmployeeNationalId(r.employeeNumber) ?? '');
      if (n) emp = n;
    }
    if (!emp) {
      skipped.push({ row: r.row, reason: 'Employee not found' });
      continue;
    }

    let inst: { startsAt: Date; endsAt: Date };
    let templateId: string | null = null;
    let breakM = r.breakMinutes;

    if (r.shiftTemplateName) {
      const t = byName.get(r.shiftTemplateName.toLowerCase().trim());
      if (!t) {
        skipped.push({ row: r.row, reason: `Template not found: ${r.shiftTemplateName}` });
        continue;
      }
      try {
        inst = buildInstantsFromImportRow(r, t);
      } catch (e) {
        skipped.push({ row: r.row, reason: e instanceof Error ? e.message : 'Bad times' });
        continue;
      }
      templateId = t.id;
      if (breakM <= 0) breakM = t.breakMinutes;
    } else {
      try {
        inst = buildInstantsFromImportRow(r, { startMinutes: 0, endMinutes: 0 });
      } catch (e) {
        skipped.push({ row: r.row, reason: e instanceof Error ? e.message : 'Bad times' });
        continue;
      }
    }

    try {
      assertWorkDateInRota(r.workDate, rota.startDate, rota.endDate);
    } catch {
      skipped.push({ row: r.row, reason: 'work date outside rota period' });
      continue;
    }

    const workDateD = new Date(r.workDate + 'T12:00:00');
    const policy = resolveRotaPolicy({ employeeJobTitle: emp.jobTitle });
    const fromDb = await loadNeighborAssignments(emp.id, inst.startsAt);
    const pending = pendingByEmployee.get(emp.id) ?? [];
    const combined = [...fromDb, ...pending];
    const tempId = `import-${r.row}`;
    const c = conflictsForProposed(
      toShiftWindows(combined),
      { id: tempId, ...inst, breakMinutes: breakM },
      emp.id,
      policy,
    );
    if (c.length) {
      skipped.push({
        row: r.row,
        reason: c
          .map((x) => x.message)
          .slice(0, 2)
          .join('; '),
      });
      continue;
    }

    try {
      const row = await prisma.shiftAssignment.create({
        data: {
          rotaPeriodId,
          employeeId: emp.id,
          shiftTemplateId: templateId,
          workDate: workDateD,
          startsAt: inst.startsAt,
          endsAt: inst.endsAt,
          breakMinutes: breakM,
          notes: r.notes,
        },
      });
      created += 1;
      const pr = pendingByEmployee.get(emp.id) ?? [];
      pr.push({
        id: row.id,
        startsAt: inst.startsAt,
        endsAt: inst.endsAt,
        breakMinutes: breakM,
      });
      pendingByEmployee.set(emp.id, pr);
    } catch {
      skipped.push({ row: r.row, reason: 'Database create failed' });
    }
  }

  return NextResponse.json({ ok: true, created, skipped, parseErrors: errors.length ? errors : undefined });
}
