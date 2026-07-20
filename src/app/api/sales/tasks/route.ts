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

export const dynamic = 'force-dynamic';

const taskInclude = {
  assignee: { select: { id: true, firstName: true, lastName: true } },
  deal: { select: { id: true, name: true, stage: true } },
  contact: { select: { id: true, name: true } },
} as const;

type TaskWithRelations = Prisma.SalesTaskGetPayload<{ include: typeof taskInclude }>;

export function mapTaskToJson(t: TaskWithRelations) {
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

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    try {
      const params = request.nextUrl.searchParams;
      const status = params.get('status')?.trim() || undefined;
      const assignee = params.get('assignee')?.trim() || undefined;
      const dealId = params.get('dealId')?.trim() || undefined;
      const leadId = params.get('leadId')?.trim() || undefined;
      const contactId = params.get('contactId')?.trim() || undefined;
      const due = params.get('due')?.trim() || undefined;

      const now = new Date();
      const startOfToday = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

      const tasks = await ctx.run(async (tx) => {
        const where: Prisma.SalesTaskWhereInput = { organizationId: ctx.organizationId };

        if (status === 'overdue') {
          where.status = 'open';
          where.dueDate = { lt: startOfToday };
        } else if (status && SALES_TASK_STATUSES.includes(status as SalesTaskStatus)) {
          where.status = status as SalesTaskStatus;
        }

        if (due === 'overdue') {
          where.status = 'open';
          where.dueDate = { lt: startOfToday };
        } else if (due === 'today') {
          where.dueDate = { gte: startOfToday, lt: endOfToday };
        } else if (due === 'week') {
          where.dueDate = { gte: startOfToday, lt: endOfWeek };
        }

        if (assignee) where.assigneeEmployeeId = assignee;
        if (dealId) where.dealId = dealId;
        if (leadId) where.leadId = leadId;
        if (contactId) where.contactId = contactId;

        // Reps only see tasks assigned to (or created by) them; managers see all.
        if (!canViewAllSalesDeals(ctx.staff.role, ctx.staff.staffUserType) && !assignee) {
          const linkedEmployeeId = await resolveEmployeeIdForStaff(
            tx,
            ctx.staff,
            ctx.organizationId,
          );
          where.OR = [
            { assigneeEmployeeId: linkedEmployeeId ?? '__unlinked__' },
            { createdByUserId: ctx.staff.id },
          ];
        }

        return tx.salesTask.findMany({
          where,
          include: taskInclude,
          orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
          take: 300,
        });
      });

      return NextResponse.json({ tasks: tasks.map(mapTaskToJson) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/sales/tasks',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load tasks.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('sales', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'title is required.' }, { status: 400 });
    }

    const type =
      typeof body.type === 'string' && SALES_DEAL_ACTIVITY_TYPES.includes(body.type as never)
        ? (body.type as never)
        : ('task' as never);

    try {
      const task = await ctx.run(async (tx) => {
        return tx.salesTask.create({
          data: {
            organizationId: ctx.organizationId,
            title,
            notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
            type,
            status: 'open',
            dueDate:
              typeof body.dueDate === 'string' && body.dueDate
                ? new Date(`${body.dueDate}T00:00:00.000Z`)
                : null,
            assigneeEmployeeId:
              typeof body.assigneeEmployeeId === 'string'
                ? body.assigneeEmployeeId.trim() || null
                : null,
            dealId: typeof body.dealId === 'string' ? body.dealId.trim() || null : null,
            leadId: typeof body.leadId === 'string' ? body.leadId.trim() || null : null,
            contactId: typeof body.contactId === 'string' ? body.contactId.trim() || null : null,
            createdByUserId: ctx.staff.id,
          },
          include: taskInclude,
        });
      });

      return NextResponse.json({ task: mapTaskToJson(task) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/sales/tasks',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create task.' }, { status: 500 });
    }
  });
}
