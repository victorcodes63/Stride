import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { canManageStaffBiometric, getSubjectMap } from '@/lib/staff-biometric/config';
import { listOrgStaffUsers } from '@/lib/staff-time-attendance/staff-directory';
import { dedupeStaffCsvRows, parseStaffPunchCsv } from '@/lib/staff-biometric/parse-staff-punch-csv';

export const dynamic = 'force-dynamic';

const MAX_PREVIEW_ROWS = 500;

type PreviewStatus = 'new' | 'duplicate_in_file' | 'already_imported';

/**
 * POST /api/staff/biometric/import/preview (multipart/form-data: `file`, `deviceId`)
 *
 * Parses a punch CSV and returns a dry-run preview: dedupe stats, which rows are
 * already imported, and matched/unmatched-to-staff counts (by device subjectMap).
 * Does not write anything.
 */
export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!canManageStaffBiometric(ctx.staff)) {
      return NextResponse.json({ error: 'You do not have permission to import punches.' }, { status: 403 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });
    }
    const file = formData.get('file') as File | null;
    const deviceId = (formData.get('deviceId') as string | null)?.trim();
    if (!file || !deviceId) {
      return NextResponse.json({ error: 'file and deviceId are required.' }, { status: 400 });
    }

    const text = await file.text();
    const { rows, error } = parseStaffPunchCsv(text);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const { unique, duplicateInFile } = dedupeStaffCsvRows(rows);

    const data = await ctx.run(async (tx) => {
      const device = await tx.staffBiometricDevice.findFirst({ where: ctx.where({ id: deviceId }) });
      if (!device) return { error: 'Device not found.', status: 404 as const };

      const subjectMap = getSubjectMap(device.config);
      const existing = await tx.staffBiometricPunch.findMany({
        where: ctx.where({
          staffBiometricDeviceId: deviceId,
          externalEventId: { in: unique.map((r) => r.externalEventId) },
        }),
        select: { externalEventId: true },
      });
      const existingIds = new Set(existing.map((e) => e.externalEventId));

      const staff = await listOrgStaffUsers(tx, ctx.organizationId);
      const nameById = new Map(staff.map((s) => [s.id, s.name] as const));

      let matchedCount = 0;
      let unmatchedCount = 0;
      let alreadyImported = 0;
      const unmatchedSubjects = new Map<string, number>();

      const previewRows = unique.slice(0, MAX_PREVIEW_ROWS).map((row) => {
        const already = existingIds.has(row.externalEventId);
        const mappedUserId = subjectMap[row.rawSubjectId] ?? null;
        const status: PreviewStatus = already ? 'already_imported' : 'new';
        return {
          rowIndex: row.rowIndex1,
          observedAt: row.observedAt.toISOString(),
          rawSubjectId: row.rawSubjectId,
          direction: row.direction,
          externalEventId: row.externalEventId,
          status,
          matchedUserId: mappedUserId,
          matchedUserName: mappedUserId ? nameById.get(mappedUserId) ?? null : null,
        };
      });

      for (const row of unique) {
        if (existingIds.has(row.externalEventId)) {
          alreadyImported += 1;
          continue;
        }
        const mappedUserId = subjectMap[row.rawSubjectId] ?? null;
        if (mappedUserId) matchedCount += 1;
        else {
          unmatchedCount += 1;
          unmatchedSubjects.set(row.rawSubjectId, (unmatchedSubjects.get(row.rawSubjectId) ?? 0) + 1);
        }
      }

      return {
        ok: true as const,
        deviceId,
        deviceName: device.name,
        totalRows: rows.length,
        uniqueRows: unique.length,
        duplicateInFile,
        alreadyImported,
        toImport: unique.length - alreadyImported,
        matchedCount,
        unmatchedCount,
        rows: previewRows,
        truncated: unique.length > MAX_PREVIEW_ROWS,
        unmatchedSubjects: [...unmatchedSubjects.entries()]
          .map(([rawSubjectId, count]) => ({ rawSubjectId, count }))
          .sort((a, b) => b.count - a.count),
      };
    });

    if ('error' in data) return NextResponse.json({ error: data.error }, { status: data.status });
    return NextResponse.json(data);
  });
}
