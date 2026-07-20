import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { resolveEmployeeIdForStaff } from '@/lib/sales/api-helpers';
import {
  SALES_DEAL_ACTIVITY_TYPES,
  SALES_TASK_STATUSES,
  type SalesTaskStatus,
} from '@/lib/sales/schema';
import { canViewAllSalesDeals } from '@/lib/staff-permissions';
import { withTenant } from '@/lib/tenant-api';
import type { StaffUser } from '@/lib/staff-api-auth';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const taskInclude = {
  assignee: { select: { id: true, firstName: true, lastName: true } },
  deal: { select: { id: true, name: true, stage: true } },
  contact: { select: { id: true, name: true } },
} as const;

type TaskWithRelations = Prisma.SalesTaskGetPayload<{ include: typeof taskInclude }>;

function mapTaskToJson(t: TaskWithRelations) {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    type: t.type,
    status: t.status,
    dueDate: t.dueDate?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    assigneeEmployeeId: t.assigneeEmployeeId,
    assignee: t.assignee
      ? { id: t.assignee.id, name: `${t.assignee.firstName} ${t.assignee.lastName}`.trim() }
      : null,
    dealId: t.dealId,
    deal: t.deal ? { id: t.deal.id, name: t.deal.name, stage: t.deal.stage } : null,
    leadId: t.leadId,
    contactId: t.contactId,
    contact: t.contact ? { id: t.contact.id, name: t.contact.name } : null,
    createdByUserId: t.createdByUserId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Reps may only touch tasks assigned to (or created by) them. */
async function canMutateTask(
  tx: Prisma.TransactionClient,
  staff: StaffUser,
  organizationId: string,
  task: { assigneeEmployeeId: string | null; createdByUserId: string | null },
): Promise<boolean> {
  if (canViewAllSalesDeals(staff.role, staff.staffUserType)) return true;
  if (task.createdByUserId && task.createdByUserId === staff.id) return true;
  const linkedEmployeeId = await resolveEmployeeIdForStaff(tx, staff, organizationId);
  return !!linkedEmployeeId && task.assigneeEmployeeId === linkedEmployeeId;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const status =
      typeof body.status === 'string' && SALES_TASK_STATUSES.includes(body.status as SalesTaskStatus)
        ? (body.status as SalesTaskStatus)
        : undefined;

    try {
      const result = await ctx.run(async (tx) => {
        const existing = await tx.salesTask.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });
        if (!existing) return { notFound: true as const };
        const allowed = await canMutateTask(tx, ctx.staff, ctx.organizationId, existing);
        if (!allowed) return { forbidden: true as const };

        const data: Prisma.SalesTaskUpdateInput = {};

        if (status) {
          data.status = status;
          data.completedAt = status === 'completed' ? new Date() : null;
        }
        if (typeof body.title === 'string' && body.title.trim()) {
          data.title = body.title.trim();
        }
        if (typeof body.notes === 'string') {
          data.notes = body.notes.trim() || null;
        }
        if (
          typeof body.type === 'string' &&
          SALES_DEAL_ACTIVITY_TYPES.includes(body.type as never)
        ) {
          data.type = body.type as never;
        }
        if (body.dueDate !== undefined) {
          data.dueDate =
            typeof body.dueDate === 'string' && body.dueDate
              ? new Date(`${body.dueDate}T00:00:00.000Z`)
              : null;
        }
        if (body.assigneeEmployeeId !== undefined) {
          const value =
            typeof body.assigneeEmployeeId === 'string' && body.assigneeEmployeeId.trim()
              ? body.assigneeEmployeeId.trim()
              : null;
          data.assignee = value ? { connect: { id: value } } : { disconnect: true };
        }

        const updated = await tx.salesTask.update({
          where: { id },
          data,
          include: taskInclude,
        });

        // Completing a task linked to a deal counts as fresh deal activity.
        if (status === 'completed' && updated.dealId) {
          await tx.salesDeal.update({
            where: { id: updated.dealId },
            data: { lastActivityAt: new Date() },
          });
        }

        return { task: updated };
      });

      if ('notFound' in result) {
        return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
      }
      if ('forbidden' in result) {
        return NextResponse.json({ error: 'You can only edit your own tasks.' }, { status: 403 });
      }

      return NextResponse.json({ task: mapTaskToJson(result.task) });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/sales/tasks/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update task.' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    const { id } = await params;

    try {
      const result = await ctx.run(async (tx) => {
        const existing = await tx.salesTask.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });
        if (!existing) return { notFound: true as const };
        const allowed = await canMutateTask(tx, ctx.staff, ctx.organizationId, existing);
        if (!allowed) return { forbidden: true as const };
        await tx.salesTask.delete({ where: { id } });
        return { ok: true as const };
      });

      if ('notFound' in result) {
        return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
      }
      if ('forbidden' in result) {
        return NextResponse.json({ error: 'You can only delete your own tasks.' }, { status: 403 });
      }

      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/sales/tasks/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete task.' }, { status: 500 });
    }
  });
}
