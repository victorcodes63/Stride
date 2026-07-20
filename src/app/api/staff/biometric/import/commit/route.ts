import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { withTenant } from '@/lib/tenant-api';
import { withOrgContext } from '@/lib/org-context';
import { canManageStaffBiometric, getSubjectMap } from '@/lib/staff-biometric/config';
import { dedupeStaffCsvRows, parseStaffPunchCsv } from '@/lib/staff-biometric/parse-staff-punch-csv';
import { materializeStaffPunches } from '@/lib/staff-biometric/ingest';

export const dynamic = 'force-dynamic';

const COMMIT_TX_TIMEOUT_MS = 120_000;

/**
 * POST /api/staff/biometric/import/commit (multipart/form-data: `file`, `deviceId`)
 *
 * Appends `StaffBiometricPunch` rows (source `csv`, deduped by
 * [device, externalEventId]). For every punch that maps to a User (via the
 * device subjectMap) it creates a `StaffAttendanceEvent` and reconciles the
 * affected day summaries.
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
    const { unique } = dedupeStaffCsvRows(rows);

    const result = await withOrgContext(
      ctx.organizationId,
      async (tx) => {
        const device = await tx.staffBiometricDevice.findFirst({
          where: { id: deviceId, organizationId: ctx.organizationId },
        });
        if (!device) return { error: 'Device not found.', status: 404 as const };

        const subjectMap = getSubjectMap(device.config);
        const externalIds = unique.map((r) => r.externalEventId);

        const toInsert: Prisma.StaffBiometricPunchCreateManyInput[] = unique.map((row) => ({
          id: randomUUID(),
          organizationId: ctx.organizationId,
          staffBiometricDeviceId: device.id,
          externalEventId: row.externalEventId,
          observedAt: row.observedAt,
          rawSubjectId: row.rawSubjectId,
          userId: subjectMap[row.rawSubjectId] ?? null,
          rawPayload: { csvRow: row.rowIndex1, source: 'import' } as Prisma.InputJsonValue,
          source: 'csv',
          direction: row.direction,
        }));

        const insert = await tx.staffBiometricPunch.createMany({ data: toInsert, skipDuplicates: true });

        let eventsCreated = 0;
        if (insert.count > 0) {
          // Only materialize punches that were newly inserted AND have no event yet
          // (materializeStaffPunches is idempotent per punch).
          const mappedRows = await tx.staffBiometricPunch.findMany({
            where: {
              organizationId: ctx.organizationId,
              staffBiometricDeviceId: device.id,
              externalEventId: { in: externalIds },
              userId: { not: null },
            },
            select: { id: true, userId: true, observedAt: true, direction: true },
          });
          const materialized = await materializeStaffPunches(
            tx,
            ctx.organizationId,
            mappedRows.map((row) => ({
              id: row.id,
              userId: row.userId!,
              observedAt: row.observedAt,
              direction: row.direction,
            })),
            ctx.staff.id,
          );
          eventsCreated = materialized.eventsCreated;
        }

        return {
          ok: true as const,
          processedRows: unique.length,
          inserted: insert.count,
          skipped: unique.length - insert.count,
          eventsCreated,
        };
      },
      { timeout: COMMIT_TX_TIMEOUT_MS },
    );

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

    await ctx.audit({
      action: 'staff_biometric.import',
      entityType: 'StaffBiometricDevice',
      entityId: deviceId,
      route: '/api/staff/biometric/import/commit',
      metadata: result,
    });

    return NextResponse.json(result);
  });
}
