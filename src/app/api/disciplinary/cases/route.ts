import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { getEssPortalUserIdForEmployee, getHrUserIds, sendNotification } from '@/lib/notifications';
import { toCaseNumber } from '@/lib/disciplinary';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const status = request.nextUrl.searchParams.get('status') || undefined;
    const employeeId = request.nextUrl.searchParams.get('employeeId') || undefined;
    const type = request.nextUrl.searchParams.get('type') || undefined;
    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    const cases = await ctx.run((tx) =>
      tx.disciplinaryCase.findMany({
        where: {
          ...ctx.where(),
          employee: { outsourcingClientId: workspaceClientId },
          ...(status ? { status: status as never } : {}),
          ...(employeeId ? { employeeId } : {}),
          ...(type ? { type: type as never } : {}),
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
          actions: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );

    await ctx.audit({
      action: 'disciplinary.case.list',
      entityType: 'DisciplinaryCase',
      route: 'GET /api/disciplinary/cases',
    });

    return NextResponse.json(cases.map((c) => ({ ...c, actionCount: c.actions.length })));
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const body = (await request.json()) as Record<string, unknown>;
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const incidentDate = typeof body.incidentDate === 'string' ? new Date(body.incidentDate) : new Date();
    const type = (typeof body.type === 'string' ? body.type : 'OTHER') as never;
    const severity = (typeof body.severity === 'string' ? body.severity : 'MINOR') as never;
    const laborJurisdiction =
      typeof body.laborJurisdiction === 'string' && body.laborJurisdiction.trim()
        ? body.laborJurisdiction.trim().toUpperCase().slice(0, 8)
        : 'KE';
    if (!employeeId || !subject || !description) {
      return NextResponse.json({ error: 'employeeId, subject, description required' }, { status: 400 });
    }

    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );
    const empInScope = await ctx.run((tx) =>
      tx.employee.findFirst({
        where: {
          id: employeeId,
          organizationId: ctx.organizationId,
          outsourcingClientId: workspaceClientId,
        },
        select: { id: true },
      }),
    );
    if (!empInScope) {
      return NextResponse.json({ error: 'Employee not found for this entity' }, { status: 404 });
    }

    const year = new Date().getUTCFullYear();
    const created = await ctx.run(async (tx) => {
      const existingCount = await tx.disciplinaryCase.count({
        where: {
          organizationId: ctx.organizationId,
          createdAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
        },
      });
      return tx.disciplinaryCase.create({
        data: {
          organizationId: ctx.organizationId,
          employeeId,
          caseNumber: toCaseNumber(year, existingCount + 1),
          type,
          severity,
          subject,
          description,
          incidentDate,
          reportedById: ctx.staff.id,
          laborJurisdiction,
        },
      });
    });

    await ctx.audit({
      action: 'disciplinary.case.created',
      entityType: 'DisciplinaryCase',
      entityId: created.id,
      route: 'POST /api/disciplinary/cases',
    });

    try {
      const employeeEss = await getEssPortalUserIdForEmployee(employeeId);
      const hrUserIds = await getHrUserIds();
      await sendNotification({
        event: 'disciplinary_case_opened',
        recipientUserIds: hrUserIds,
        recipientEssPortalUserIds: employeeEss ? [employeeEss] : [],
        title: `Disciplinary case opened (${created.caseNumber})`,
        body: subject,
        href: `/dashboard/disciplinary/cases/${created.id}`,
        priority: 'action_required',
        channel: 'in_app',
        metadata: { caseId: created.id },
      });
    } catch (error) {
      console.error('disciplinary notification error', error);
    }

    return NextResponse.json(created, { status: 201 });
  });
}
