import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessPayroll, forbiddenResponse } from '@/lib/demo-route-access';
import { createWorkflowRun, getPayrollUserIds, sendNotification, transitionWorkflowRun } from '@/lib/notifications';
import { enforceSodCheck, requireRecentSensitiveAuth, SodViolationError } from '@/lib/admin-security';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      if (!canAccessPayroll(ctx.staff)) {
        return forbiddenResponse('Payroll access is restricted to finance and admins.');
      }
      const reauthError = requireRecentSensitiveAuth(request, ctx.staff.id);
      if (reauthError) return reauthError;
      if (!process.env.DATABASE_URL) {
        return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
      }

      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const month = typeof body.month === 'number' ? body.month : parseInt(String(body.month ?? ''), 10);
      const year = typeof body.year === 'number' ? body.year : parseInt(String(body.year ?? ''), 10);
      const requestedClientId = typeof body.clientId === 'string' && body.clientId.trim() ? body.clientId.trim() : null;
      const clientId = await resolvePrimaryWorkspaceClientId(
        prisma,
        requestedClientId,
        request,
        ctx.organizationId,
      );
      const departmentId =
        typeof body.departmentId === 'string' && body.departmentId.trim() ? body.departmentId.trim() : null;

      if (Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(year)) {
        return NextResponse.json({ error: 'Valid month (1-12) and year are required' }, { status: 400 });
      }

      const batchEntityId = `${year}-${month}-${clientId}`;
      await enforceSodCheck({
        actorUserId: ctx.staff.id,
        organizationId: ctx.organizationId,
        entityType: 'PayrollBatch',
        entityId: batchEntityId,
        forbiddenActions: ['payroll.generated', 'payroll.updated'],
        actionLabel: 'payroll run approval',
      });

      const draftPayrolls = await ctx.run((tx) =>
        tx.payroll.findMany({
          where: {
            ...ctx.where(),
            month,
            year,
            status: 'draft',
            employee: {
              outsourcingClientId: clientId,
              ...(departmentId ? { departmentId } : {}),
              client: { organizationId: ctx.organizationId },
            },
          },
          select: { id: true },
        }),
      );

      if (draftPayrolls.length === 0) {
        return NextResponse.json({ error: 'No draft payroll records to approve in this scope.' }, { status: 409 });
      }

      const ids = draftPayrolls.map((p) => p.id);
      const result = await ctx.run((tx) =>
        tx.payroll.updateMany({
          where: { id: { in: ids } },
          data: { status: 'approved' },
        }),
      );

      await ctx.audit({
        action: 'payroll.run.approve',
        entityType: 'PayrollBatch',
        entityId: batchEntityId,
        route: 'POST /api/outsourcing/payroll/run/approve',
        metadata: {
          month,
          year,
          clientId,
          departmentId,
          approvedCount: result.count,
          approver: ctx.staff.name,
        },
      });

      try {
        const workflowRun = await ctx.run((tx) =>
          tx.workflowRun.findFirst({
            where: { entityType: 'PayrollBatch', entityId: batchEntityId },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          }),
        );
        if (workflowRun) {
          await transitionWorkflowRun(workflowRun.id, 'approved', { actorUserId: ctx.staff.id });
        } else {
          await createWorkflowRun({
            module: 'payroll',
            event: 'payroll_approved',
            entityType: 'PayrollBatch',
            entityId: batchEntityId,
            assigneeUserId: ctx.staff.id,
            metadata: { month, year, clientId, approvedCount: result.count },
          });
        }
        const payrollUserIds = await getPayrollUserIds();
        await sendNotification({
          event: 'payroll_approved',
          recipientUserIds: payrollUserIds,
          title: 'Payroll run approved',
          body: `${month}/${year} payroll run approved by ${ctx.staff.name} (${result.count} employee(s)).`,
          href: '/dashboard/payroll',
          priority: 'info',
          channel: 'in_app',
          workflowRunId: workflowRun?.id,
          metadata: { month, year, clientId, approvedCount: result.count, approver: ctx.staff.name },
        });
      } catch (err) {
        console.error('[notifications] payroll run approve:', err);
      }

      return NextResponse.json({
        approvedCount: result.count,
        message: `Approved ${result.count} payroll record(s) for ${month}/${year}.`,
      });
    } catch (e) {
      if (e instanceof SodViolationError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }
  });
}
