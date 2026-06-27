import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { parseBiometricPunchCsv } from '@/lib/biometric/parse-csv';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { reconcileAttendanceDay, resolveReconcileWorkDatesForObservedAt } from '@/lib/attendance-reconciliation';
import { withTenant } from '@/lib/tenant-api';

/**
 * `multipart/form-data`: `file` (text/csv), `clientId` (OutsourcingClient id), `deviceId` (BiometricDevice id for this client).
 *
 * Required CSV columns: `observedAt` (or at / timestamp) and one of `employeeId` or `employeeNumber` (per employee within the client).
 * Optional: `externalEventId`, `rawSubjectId`, `direction` (in | out | unknown).
 * Punches are append-only; same `externalEventId`+device re-imports are ignored (`skipDuplicates`).
 */
export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const clientId = (formData.get('clientId') as string | null)?.trim();
      const deviceId = (formData.get('deviceId') as string | null)?.trim();

      if (!file || !clientId || !deviceId) {
        return NextResponse.json(
          { error: 'file, clientId, and deviceId are required.' },
          { status: 400 },
        );
      }

      const text = await file.text();
      const { rows, error: parseError } = parseBiometricPunchCsv(text);
      if (parseError) {
        return NextResponse.json({ error: parseError }, { status: 400 });
      }
      if (rows.length === 0) {
        return NextResponse.json({ error: 'No data rows in CSV' }, { status: 400 });
      }

      const result = await ctx.run(async (tx) => {
        const [client, device] = await Promise.all([
          tx.outsourcingClient.findFirst({
            where: ctx.where({ id: clientId }),
          }),
          tx.biometricDevice.findFirst({
            where: ctx.where({ id: deviceId, outsourcingClientId: clientId }),
          }),
        ]);

        if (!client) {
          return { error: 'Client not found', status: 404 as const };
        }
        if (!device) {
          return { error: 'Biometric device not found for this client', status: 404 as const };
        }

        const employees = await tx.employee.findMany({
          where: ctx.where({ outsourcingClientId: clientId }),
          select: { id: true, employeeNumber: true },
        });
        const byId = new Map(employees.map((e) => [e.id, e] as const));
        const byNumber = new Map(
          employees
            .filter((e) => e.employeeNumber != null && e.employeeNumber !== '')
            .map((e) => [e.employeeNumber!.trim().toLowerCase(), e] as const),
        );

        const toInsert: Prisma.BiometricPunchCreateManyInput[] = [];

        for (const line of rows) {
          let empId: string;
          if (line.resolveBy === 'id') {
            const e = byId.get(line.employeeId);
            if (!e) {
              return {
                error: `Row ${line.rowIndex1 + 1}: employeeId not found in client`,
                status: 400 as const,
              };
            }
            empId = e.id;
          } else {
            const e = byNumber.get(line.employeeNumber.trim().toLowerCase());
            if (!e) {
              return {
                error: `Row ${line.rowIndex1 + 1}: employeeNumber not found in client`,
                status: 400 as const,
              };
            }
            empId = e.id;
          }

          toInsert.push({
            id: randomUUID(),
            organizationId: ctx.organizationId,
            biometricDeviceId: device.id,
            externalEventId: line.externalEventId,
            observedAt: line.observedAt,
            rawSubjectId: line.rawSubjectId,
            employeeId: empId,
            rawPayload: { csvRow: line.rowIndex1, source: 'import' } as Prisma.InputJsonValue,
            source: 'csv',
            direction: line.direction,
          });
        }

        const r = await tx.biometricPunch.createMany({ data: toInsert, skipDuplicates: true });

        if (isFeatureEnabled('attendanceV2') && r.count > 0) {
          const inserted = await tx.biometricPunch.findMany({
            where: ctx.where({
              biometricDeviceId: device.id,
              externalEventId: { in: rows.map((line) => line.externalEventId) },
            }),
            select: { id: true, employeeId: true, observedAt: true, direction: true },
          });
          for (const row of inserted) {
            if (!row.employeeId) continue;
            const workDate = row.observedAt.toISOString().slice(0, 10);
            await tx.attendanceEvent.create({
              data: {
                organizationId: ctx.organizationId,
                employeeId: row.employeeId,
                outsourcingClientId: clientId,
                observedAt: row.observedAt,
                workDate: new Date(`${workDate}T00:00:00.000Z`),
                source: 'biometric',
                kind: row.direction === 'out' ? 'check_out' : 'check_in',
                biometricPunchId: row.id,
              },
            });
            const workDates = await resolveReconcileWorkDatesForObservedAt(tx, row.employeeId, row.observedAt);
            for (const dateKey of workDates) {
              await reconcileAttendanceDay(tx, { employeeId: row.employeeId, workDate: dateKey });
            }
          }
        }

        return {
          ok: true as const,
          processedRows: rows.length,
          inserted: r.count,
          attendanceV2: isFeatureEnabled('attendanceV2'),
        };
      });

      if ('error' in result && 'status' in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Import failed' },
        { status: 500 },
      );
    }
  });
}
