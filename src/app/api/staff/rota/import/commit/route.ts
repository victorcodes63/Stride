import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { RotaPeriodStatus } from '@prisma/client';
import { canManageStaffRota } from '@/lib/staff-rota/api-auth';
import {
  buildInstantsFromStaffImportRow,
  normalizeStaffKey,
  parseStaffRotaImportCsv,
} from '@/lib/staff-rota/import-adapter';
import {
  detectConflictsForUser,
  resolveStaffRotaPolicy,
  isBlockingConflict,
  type ShiftWindow,
} from '@/lib/staff-rota/policy-engine';
import { assertWorkDateInRota } from '@/lib/staff-rota/assignment-helpers';
import { listOrgStaffUsers } from '@/lib/staff-time-attendance/staff-directory';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canManageStaffRota(ctx.staff)) {
      return NextResponse.json({ error: 'You do not have permission to import' }, { status: 403 });
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rotaPeriodId = String(formData.get('rotaPeriodId') ?? '').trim();
    if (!file || !rotaPeriodId) {
      return NextResponse.json({ error: 'file and rotaPeriodId are required' }, { status: 400 });
    }

    const text = await file.text();
    const { rows, errors } = parseStaffRotaImportCsv(text);
    if (errors.length && !rows.length) {
      return NextResponse.json({ ok: false, parseErrors: errors, created: 0, skipped: [] });
    }

    const result = await ctx.run(async (tx) => {
      const rota = await tx.staffRotaPeriod.findFirst({ where: ctx.where({ id: rotaPeriodId }) });
      if (!rota) return { status: 404 as const, error: 'Rota period not found' };
      if (rota.status === RotaPeriodStatus.published) {
        return { status: 409 as const, error: 'This period is published. Unpublish it to import.' };
      }

      const subjects = await listOrgStaffUsers(tx, ctx.organizationId);
      const byEmail = new Map(subjects.map((s) => [s.email.toLowerCase().trim(), s]));
      const byName = new Map(subjects.map((s) => [normalizeStaffKey(s.name), s]));

      const templates = await tx.staffShiftTemplate.findMany({ where: ctx.where({ isActive: true }) });
      const templateByName = new Map(templates.map((t) => [t.name.toLowerCase().trim(), t]));

      // Pre-load neighbor shifts for conflict checks in memory.
      const from = new Date(rota.startDate);
      from.setDate(from.getDate() - 35);
      const to = new Date(rota.endDate);
      to.setDate(to.getDate() + 35);
      const existing = await tx.staffShiftAssignment.findMany({
        where: { organizationId: ctx.organizationId, startsAt: { gte: from, lte: to } },
        select: { id: true, userId: true, startsAt: true, endsAt: true, breakMinutes: true },
      });
      const windowsByUser = new Map<string, ShiftWindow[]>();
      for (const e of existing) {
        const arr = windowsByUser.get(e.userId) ?? [];
        arr.push({ id: e.id, startsAt: e.startsAt, endsAt: e.endsAt, breakMinutes: e.breakMinutes });
        windowsByUser.set(e.userId, arr);
      }

      const skipped: { row: number; reason: string }[] = [];
      const toCreate: Prisma.StaffShiftAssignmentCreateManyInput[] = [];

      for (const r of rows) {
        let subject = byEmail.get(r.staff.toLowerCase().trim());
        if (!subject) subject = byName.get(normalizeStaffKey(r.staff));
        if (!subject) {
          skipped.push({ row: r.row, reason: 'Staff member not found' });
          continue;
        }

        let template = null;
        if (r.shiftTemplateName) {
          template = templateByName.get(r.shiftTemplateName.toLowerCase().trim()) ?? null;
          if (!template) {
            skipped.push({ row: r.row, reason: `Template not found: ${r.shiftTemplateName}` });
            continue;
          }
        }

        let inst: { startsAt: Date; endsAt: Date };
        try {
          inst = buildInstantsFromStaffImportRow(r, template ?? { startMinutes: 0, endMinutes: 0 });
        } catch (e) {
          skipped.push({ row: r.row, reason: e instanceof Error ? e.message : 'Bad times' });
          continue;
        }

        try {
          assertWorkDateInRota(r.workDate, rota.startDate, rota.endDate);
        } catch {
          skipped.push({ row: r.row, reason: 'Work date outside rota period' });
          continue;
        }

        const breakMinutes = r.breakMinutes > 0 ? r.breakMinutes : template?.breakMinutes ?? 0;
        const policy = resolveStaffRotaPolicy({ staffUserType: subject.staffUserType, department: subject.department });
        const windows = windowsByUser.get(subject.id) ?? [];
        const proposed: ShiftWindow = { id: `import-${r.row}`, startsAt: inst.startsAt, endsAt: inst.endsAt, breakMinutes };
        const conflicts = detectConflictsForUser(subject.id, [...windows, proposed], policy).filter(isBlockingConflict);
        if (conflicts.length) {
          skipped.push({ row: r.row, reason: conflicts.map((c) => c.message).slice(0, 2).join('; ') });
          continue;
        }

        windows.push(proposed);
        windowsByUser.set(subject.id, windows);
        toCreate.push({
          organizationId: ctx.organizationId,
          staffRotaPeriodId: rotaPeriodId,
          userId: subject.id,
          staffShiftTemplateId: template?.id ?? null,
          workDate: new Date(`${r.workDate}T12:00:00`),
          startsAt: inst.startsAt,
          endsAt: inst.endsAt,
          breakMinutes,
          notes: r.notes,
        });
      }

      if (toCreate.length) await tx.staffShiftAssignment.createMany({ data: toCreate });
      return { status: 200 as const, created: toCreate.length, skipped };
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await ctx.audit({
      action: 'staff_rota.import.commit',
      entityType: 'StaffRotaPeriod',
      entityId: rotaPeriodId,
      route: request.nextUrl.pathname,
      metadata: { created: result.created, skipped: result.skipped.length },
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      skipped: result.skipped,
      parseErrors: errors.length ? errors : undefined,
    });
  });
}
