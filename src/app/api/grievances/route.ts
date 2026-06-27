import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { toGrievanceNumber } from '@/lib/disciplinary';
import { getHrUserIds, sendNotification } from '@/lib/notifications';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const status = request.nextUrl.searchParams.get('status') || undefined;
    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    const grievances = await ctx.run((tx) =>
      tx.grievance.findMany({
        where: {
          ...ctx.where(),
          employee: { outsourcingClientId: workspaceClientId },
          ...(status ? { status: status as never } : {}),
        },
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { submittedAt: 'desc' },
      }),
    );

    await ctx.audit({
      action: 'grievance.list',
      entityType: 'Grievance',
      route: 'GET /api/grievances',
    });

    return NextResponse.json(grievances);
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
    const category = (typeof body.category === 'string' ? body.category : 'OTHER') as never;
    const againstId = typeof body.againstId === 'string' && body.againstId.trim() ? body.againstId : null;
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
    const grievance = await ctx.run(async (tx) => {
      const count = await tx.grievance.count({
        where: {
          organizationId: ctx.organizationId,
          submittedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
        },
      });
      return tx.grievance.create({
        data: {
          organizationId: ctx.organizationId,
          employeeId,
          grievanceNumber: toGrievanceNumber(year, count + 1),
          subject,
          description,
          category,
          againstId,
        },
      });
    });

    await ctx.audit({
      action: 'grievance.created',
      entityType: 'Grievance',
      entityId: grievance.id,
      route: 'POST /api/grievances',
    });

    const hrUserIds = await getHrUserIds();
    await sendNotification({
      event: 'grievance_submitted',
      recipientUserIds: hrUserIds,
      title: `New grievance ${grievance.grievanceNumber}`,
      body: grievance.subject,
      href: `/dashboard/disciplinary/grievances/${grievance.id}`,
      priority: 'action_required',
      channel: 'in_app',
      metadata: { grievanceId: grievance.id },
    });

    return NextResponse.json(grievance, { status: 201 });
  });
}
