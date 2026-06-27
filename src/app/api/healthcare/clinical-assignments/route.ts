import { NextRequest, NextResponse } from 'next/server';
import type { HealthcareClinicalRole } from '@prisma/client';
import { canWriteRota } from '@/lib/rota/api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { instantsFromTemplateMinutes } from '@/lib/rota/shift-instants';
import { toShiftWindows, assertWorkDateInRota, conflictsForProposed } from '@/lib/rota/assignment-helpers';
import { resolveRotaPolicy } from '@/lib/rota/conflict-rules';
import { mergeHealthcareRotaPolicy } from '@/lib/healthcare/clinical-rota-policy';
import { evaluateLicenseGate, parseRequiredCredentials } from '@/lib/healthcare/license-gate';
import { canAccessHealthcare, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { serializeClinicalAssignment } from '@/lib/healthcare/serialize';
import { withTenant } from '@/lib/tenant-api';

const ROLES: HealthcareClinicalRole[] = [
  'nurse',
  'medical_officer',
  'anaesthetist',
  'clinical_officer',
  'support',
];

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessHealthcare(ctx.staff)) {
      return forbiddenResponse('Healthcare access is restricted to operations and admin users.');
    }

    const from = request.nextUrl.searchParams.get('from')?.trim();
    const to = request.nextUrl.searchParams.get('to')?.trim();
    const wardId = request.nextUrl.searchParams.get('wardId')?.trim();

    try {
      const assignments = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return tx.healthcareClinicalAssignment.findMany({
          where: {
            ...ctx.where(),
            outsourcingClientId: clientId,
            ...(wardId ? { wardId } : {}),
            ...(from && to
              ? {
                  workDate: {
                    gte: new Date(from),
                    lte: new Date(to),
                  },
                }
              : {}),
          },
          include: {
            ward: true,
            employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
          },
          orderBy: [{ workDate: 'asc' }, { startsAt: 'asc' }],
          take: 500,
        });
      });

      return NextResponse.json({
        assignments: assignments.map(serializeClinicalAssignment),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/healthcare/clinical-assignments',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load clinical assignments.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessHealthcare(ctx.staff) || !canWriteRota(ctx.staff)) {
      return forbiddenResponse('You do not have permission to assign clinical shifts.');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const wardId = typeof body.wardId === 'string' ? body.wardId.trim() : '';
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
    const workDateStr = typeof body.workDate === 'string' ? body.workDate.trim() : '';
    const startMinutes = Number(body.startMinutes ?? body.startTime);
    const endMinutes = Number(body.endMinutes ?? body.endTime);
    const allowUnlicensed = body.allowUnlicensed === true;

    if (!wardId || !employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(workDateStr)) {
      return NextResponse.json(
        { error: 'wardId, employeeId, and workDate (YYYY-MM-DD) are required.' },
        { status: 400 },
      );
    }

    const clinicalRole =
      typeof body.clinicalRole === 'string' && ROLES.includes(body.clinicalRole as HealthcareClinicalRole)
        ? (body.clinicalRole as HealthcareClinicalRole)
        : 'nurse';

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        const [ward, employee] = await Promise.all([
          tx.healthcareWard.findFirst({
            where: { ...ctx.where(), id: wardId, outsourcingClientId: clientId },
          }),
          tx.employee.findFirst({
            where: {
              ...ctx.where(),
              id: employeeId,
              outsourcingClientId: clientId,
            },
          }),
        ]);

        if (!ward) return { error: 'Ward not found.', status: 404 as const };
        if (!employee) return { error: 'Employee not found.', status: 404 as const };

        let startsAt: Date;
        let endsAt: Date;
        if (Number.isFinite(startMinutes) && Number.isFinite(endMinutes)) {
          const inst = instantsFromTemplateMinutes(workDateStr, startMinutes, endMinutes);
          startsAt = inst.startsAt;
          endsAt = inst.endsAt;
        } else if (typeof body.startsAt === 'string' && typeof body.endsAt === 'string') {
          startsAt = new Date(body.startsAt);
          endsAt = new Date(body.endsAt);
        } else {
          return { error: 'Provide startMinutes+endMinutes or startsAt+endsAt.', status: 400 as const };
        }

        const credentials = await tx.employeeCredential.findMany({
          where: { ...ctx.where(), employeeId },
        });
        const license = evaluateLicenseGate(
          credentials,
          parseRequiredCredentials(ward.requiredCredentials),
          startsAt,
        );

        if (!license.ok && !allowUnlicensed) {
          return {
            error: 'Licence gate failed',
            status: 409 as const,
            warnings: license.warnings,
            license,
          };
        }

        const rotaPeriodId = typeof body.rotaPeriodId === 'string' ? body.rotaPeriodId.trim() : '';
        let shiftAssignmentId: string | null = null;

        if (rotaPeriodId) {
          const rota = await tx.rotaPeriod.findFirst({
            where: { ...ctx.where(), id: rotaPeriodId },
          });
          if (!rota) return { error: 'Rota period not found.', status: 404 as const };
          assertWorkDateInRota(workDateStr, rota.startDate, rota.endDate);

          const basePolicy = resolveRotaPolicy({ employeeJobTitle: employee.jobTitle });
          const policy = mergeHealthcareRotaPolicy(basePolicy, {
            clinical: true,
            minRestHours: ward.minRestHours,
          });

          const neighbors = await tx.shiftAssignment.findMany({
            where: {
              ...ctx.where(),
              employeeId,
              startsAt: {
                gte: new Date(startsAt.getTime() - 35 * 86400000),
                lte: new Date(endsAt.getTime() + 35 * 86400000),
              },
            },
          });

          const conflicts = conflictsForProposed(
            toShiftWindows(neighbors),
            { id: `proposed-${Date.now()}`, startsAt, endsAt, breakMinutes: 0 },
            employeeId,
            policy,
          );
          if (conflicts.length) {
            return { error: 'Clinical rota conflict', status: 409 as const, conflicts, policy };
          }

          const shift = await tx.shiftAssignment.create({
            data: {
              organizationId: ctx.organizationId,
              rotaPeriodId,
              employeeId,
              workDate: new Date(`${workDateStr}T12:00:00`),
              startsAt,
              endsAt,
              breakMinutes: 0,
              notes: typeof body.notes === 'string' ? body.notes : `Clinical — ${ward.code}`,
            },
          });
          shiftAssignmentId = shift.id;
        }

        const created = await tx.healthcareClinicalAssignment.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            wardId,
            employeeId,
            clinicalRole,
            workDate: new Date(`${workDateStr}T12:00:00`),
            startsAt,
            endsAt,
            shiftAssignmentId,
            licenseOk: license.ok,
            licenseWarnings: license.warnings,
            notes: typeof body.notes === 'string' ? body.notes : null,
          },
          include: {
            ward: true,
            employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
          },
        });

        return { created, license };
      });

      if ('status' in result && result.status !== undefined && 'error' in result) {
        const { error, status } = result;
        if (status === 409 && 'warnings' in result) {
          return NextResponse.json(
            { error, warnings: result.warnings, license: result.license },
            { status: 409 },
          );
        }
        if (status === 409 && 'conflicts' in result) {
          return NextResponse.json(
            { error, conflicts: result.conflicts, policy: result.policy },
            { status: 409 },
          );
        }
        return NextResponse.json({ error }, { status });
      }

      return NextResponse.json(
        { assignment: serializeClinicalAssignment(result.created), license: result.license },
        { status: 201 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign clinical shift.';
      await reportApiError({ route: 'POST /api/healthcare/clinical-assignments', message });
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}
