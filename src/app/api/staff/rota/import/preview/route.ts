import { NextRequest, NextResponse } from 'next/server';
import { canManageStaffRota } from '@/lib/staff-rota/api-auth';
import {
  buildInstantsFromStaffImportRow,
  normalizeStaffKey,
  parseStaffRotaImportCsv,
} from '@/lib/staff-rota/import-adapter';
import { listOrgStaffUsers } from '@/lib/staff-time-attendance/staff-directory';
import { withTenant } from '@/lib/tenant-api';

type PreviewRow = {
  row: number;
  staff: string;
  workDate: string;
  userId: string | null;
  userName?: string;
  matchReason?: string;
  templateId: string | null;
  templateName?: string | null;
  startsAt: string | null;
  endsAt: string | null;
  breakMinutes: number;
  error?: string;
};

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
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

    const text = await file.text();
    const { rows, errors, headers } = parseStaffRotaImportCsv(text);
    if (errors.length && !rows.length) {
      return NextResponse.json({ ok: false, parseErrors: errors, headers, rows: [] });
    }

    const rowsOut = await ctx.run(async (tx) => {
      const subjects = await listOrgStaffUsers(tx, ctx.organizationId);
      const byEmail = new Map(subjects.map((s) => [s.email.toLowerCase().trim(), s]));
      const byName = new Map(subjects.map((s) => [normalizeStaffKey(s.name), s]));

      const templates = await tx.staffShiftTemplate.findMany({ where: ctx.where({ isActive: true }) });
      const templateByName = new Map(templates.map((t) => [t.name.toLowerCase().trim(), t]));

      const out: PreviewRow[] = [];
      for (const r of rows) {
        const key = normalizeStaffKey(r.staff);
        let subject = byEmail.get(r.staff.toLowerCase().trim());
        let matchReason: string | undefined = subject ? 'email' : undefined;
        if (!subject) {
          subject = byName.get(key);
          if (subject) matchReason = 'name';
        }
        if (!subject) {
          out.push({
            row: r.row,
            staff: r.staff,
            workDate: r.workDate,
            userId: null,
            templateId: null,
            startsAt: null,
            endsAt: null,
            breakMinutes: r.breakMinutes,
            error: 'Staff member not found (match by email or full name)',
          });
          continue;
        }

        let template = null;
        if (r.shiftTemplateName) {
          template = templateByName.get(r.shiftTemplateName.toLowerCase().trim()) ?? null;
          if (!template) {
            out.push({
              row: r.row,
              staff: r.staff,
              workDate: r.workDate,
              userId: subject.id,
              userName: subject.name,
              matchReason,
              templateId: null,
              startsAt: null,
              endsAt: null,
              breakMinutes: r.breakMinutes,
              error: `Template "${r.shiftTemplateName}" not found`,
            });
            continue;
          }
        }

        try {
          const inst = buildInstantsFromStaffImportRow(r, template ?? { startMinutes: 0, endMinutes: 0 });
          const br = r.breakMinutes > 0 ? r.breakMinutes : template?.breakMinutes ?? 0;
          out.push({
            row: r.row,
            staff: r.staff,
            workDate: r.workDate,
            userId: subject.id,
            userName: subject.name,
            matchReason,
            templateId: template?.id ?? null,
            templateName: template?.name ?? null,
            startsAt: inst.startsAt.toISOString(),
            endsAt: inst.endsAt.toISOString(),
            breakMinutes: br,
          });
        } catch (e) {
          out.push({
            row: r.row,
            staff: r.staff,
            workDate: r.workDate,
            userId: subject.id,
            userName: subject.name,
            matchReason,
            templateId: template?.id ?? null,
            startsAt: null,
            endsAt: null,
            breakMinutes: r.breakMinutes,
            error: e instanceof Error ? e.message : 'Invalid times',
          });
        }
      }
      return out;
    });

    return NextResponse.json({ ok: true, headers, parseErrors: errors, rows: rowsOut });
  });
}
