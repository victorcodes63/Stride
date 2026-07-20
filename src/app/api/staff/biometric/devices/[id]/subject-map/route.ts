import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { withOrgContext } from '@/lib/org-context';
import { listOrgStaffUserIds } from '@/lib/staff-time-attendance/staff-directory';
import {
  canManageStaffBiometric,
  getSubjectMap,
  parseStaffDeviceConfig,
  serializeStaffDeviceConfig,
} from '@/lib/staff-biometric/config';
import { materializeStaffPunches } from '@/lib/staff-biometric/ingest';

export const dynamic = 'force-dynamic';

const MAP_TX_TIMEOUT_MS = 60_000;

/**
 * POST /api/staff/biometric/devices/[id]/subject-map
 *
 * Assign (or clear) a `rawSubjectId -> userId` mapping stored in the device
 * config. When assigning, backfill `userId` on the device's matching unmapped
 * punches, create the corresponding attendance events, and reconcile the
 * affected day summaries.
 *
 * Body: `{ rawSubjectId: string, userId: string | null }`.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    if (!canManageStaffBiometric(ctx.staff)) {
      return NextResponse.json({ error: 'You do not have permission to map subjects.' }, { status: 403 });
    }
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const rawSubjectId = String(body.rawSubjectId ?? '').trim();
    if (!rawSubjectId) return NextResponse.json({ error: 'rawSubjectId is required.' }, { status: 400 });
    const userIdRaw = body.userId == null ? '' : String(body.userId).trim();
    const unmap = userIdRaw === '';

    const result = await withOrgContext(
      ctx.organizationId,
      async (tx) => {
        const device = await tx.staffBiometricDevice.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });
        if (!device) return { error: 'Device not found.', status: 404 as const };

        const subjectMap = getSubjectMap(device.config);

        if (unmap) {
          delete subjectMap[rawSubjectId];
        } else {
          const validIds = new Set(await listOrgStaffUserIds(tx, ctx.organizationId));
          if (!validIds.has(userIdRaw)) {
            return { error: 'Selected staff member is not in this organization.', status: 400 as const };
          }
          subjectMap[rawSubjectId] = userIdRaw;
        }

        const nextConfig = parseStaffDeviceConfig(device.config);
        nextConfig.subjectMap = subjectMap;
        await tx.staffBiometricDevice.update({
          where: { id: device.id },
          data: { config: serializeStaffDeviceConfig(nextConfig) },
        });

        if (unmap) {
          return { ok: true as const, unmapped: true, backfilled: 0, eventsCreated: 0 };
        }

        // Backfill unmapped punches for this subject, then materialize attendance.
        const punches = await tx.staffBiometricPunch.findMany({
          where: {
            organizationId: ctx.organizationId,
            staffBiometricDeviceId: device.id,
            rawSubjectId,
            userId: null,
          },
          select: { id: true, observedAt: true, direction: true },
        });

        if (punches.length > 0) {
          await tx.staffBiometricPunch.updateMany({
            where: {
              organizationId: ctx.organizationId,
              staffBiometricDeviceId: device.id,
              rawSubjectId,
              userId: null,
            },
            data: { userId: userIdRaw },
          });
        }

        const materialized = await materializeStaffPunches(
          tx,
          ctx.organizationId,
          punches.map((p) => ({
            id: p.id,
            userId: userIdRaw,
            observedAt: p.observedAt,
            direction: p.direction,
          })),
          ctx.staff.id,
        );

        return {
          ok: true as const,
          unmapped: false,
          backfilled: punches.length,
          eventsCreated: materialized.eventsCreated,
        };
      },
      { timeout: MAP_TX_TIMEOUT_MS },
    );

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await ctx.audit({
      action: unmap ? 'staff_biometric_device.unmap_subject' : 'staff_biometric_device.map_subject',
      entityType: 'StaffBiometricDevice',
      entityId: id,
      route: `/api/staff/biometric/devices/${id}/subject-map`,
      metadata: { rawSubjectId, userId: unmap ? null : userIdRaw, ...result },
    });

    return NextResponse.json(result);
  });
}
