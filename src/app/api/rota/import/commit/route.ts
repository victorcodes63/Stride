import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { canWriteRota } from '@/lib/rota/api-auth';
import { buildInstantsFromImportRow, parseRotaImportCsv } from '@/lib/rota/import-adapter';
import { normalizeEmployeeNationalId } from '@/lib/outsourcing-employee-national-id';
import { resolveRotaPolicy } from '@/lib/rota/conflict-rules';
import { assertWorkDateInRota, toShiftWindows, conflictsForProposed } from '@/lib/rota/assignment-helpers';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

async function loadNeighborAssignments(
  tx: Prisma.TransactionClient,
  employeeId: string,
  center: Date,
) {
  const from = new Date(center);
  from.setDate(from.getDate() - 35);
  const to = new Date(center);
  to.setDate(to.getDate() + 35);
  return tx.shiftAssignment.findMany({
    where: { employeeId, startsAt: { gte: from, lte: to } },
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canWriteRota(ctx.staff)) {
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

    const text = await file.text();
    const { rows, errors } = parseRotaImportCsv(text);
    if (errors.length && !rows.length) {
      return NextResponse.json({ ok: false, parseErrors: errors, created: 0, skipped: [] });
    }

    const result = await ctx.run(async (tx) => {
      const clientId = await resolvePrimaryWorkspaceClientId(
        tx,
        requestedClientId,
        request,
        ctx.organizationId,
      );

      const rota = await tx.rotaPeriod.findFirst({ where: ctx.where({ id: rotaPeriodId }) });
      if (!rota) return { error: 'Rota period not found' as const };
      if (rota.outsourcingClientId !== clientId) {
        return { error: 'Rota period does not match client' as const };
      }

      const templates = await tx.shiftTemplate.findMany({
        where: ctx.where({ outsourcingClientId: clientId, isActive: true }),
      });
      const byName = new Map(templates.map((t) => [t.name.toLowerCase().trim(), t]));

      const employees = await tx.employee.findMany({
        where: ctx.where({ outsourcingClientId: clientId }),
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
      const pendingByEmployee = new Map<
        string,
        { id: string; startsAt: Date; endsAt: Date; breakMinutes: number }[]
      >();

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

        const policy = resolveRotaPolicy({ employeeJobTitle: emp.jobTitle });
        const fromDb = await loadNeighborAssignments(tx, emp.id, inst.startsAt);
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
          const workDateD = new Date(r.workDate + 'T12:00:00');
          const row = await tx.shiftAssignment.create({
            data: {
              organizationId: ctx.organizationId,
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

      return { ok: true as const, created, skipped, parseErrors: errors.length ? errors : undefined };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result);
  });
}
