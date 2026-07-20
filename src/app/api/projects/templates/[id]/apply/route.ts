import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { allocateProjectCode } from '@/lib/projects/project-code';
import { logProjectActivity } from '@/lib/projects/activity';
import { serializeProject } from '@/lib/projects/serialize';
import { countBlueprintTasks, expandTemplateBlueprint } from '@/lib/projects/templates';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const targetProjectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : null;
    const newProjectName =
      typeof body.newProjectName === 'string' && body.newProjectName.trim() ? body.newProjectName.trim() : null;
    const department = typeof body.department === 'string' && body.department.trim() ? body.department.trim() : null;
    const dueDate = typeof body.dueDate === 'string' && body.dueDate.trim() ? new Date(body.dueDate) : null;

    if (!targetProjectId && !newProjectName) {
      return NextResponse.json(
        { error: 'Provide either projectId or newProjectName.' },
        { status: 400 },
      );
    }

    try {
      const result = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);

        const template = await tx.projectTemplate.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });
        if (!template) return { notFound: 'Template not found.' as const };

        const expanded = expandTemplateBlueprint(template.blueprint);

        // Resolve or create the target project.
        let projectId: string;
        if (targetProjectId) {
          const project = await tx.project.findFirst({
            where: { id: targetProjectId, organizationId: ctx.organizationId, outsourcingClientId: clientId },
            select: { id: true },
          });
          if (!project) return { notFound: 'Project not found.' as const };
          projectId = project.id;
        } else {
          const projectCode = await allocateProjectCode(tx, clientId);
          const created = await tx.project.create({
            data: {
              organizationId: ctx.organizationId,
              outsourcingClientId: clientId,
              projectCode,
              name: newProjectName as string,
              description: template.description,
              department,
              status: 'planning',
              currency: 'KES',
              dueDate,
              ownerUserId: ctx.staff.id,
              createdByUserId: ctx.staff.id,
            },
            select: { id: true },
          });
          projectId = created.id;
          await logProjectActivity(tx, {
            organizationId: ctx.organizationId,
            projectId,
            type: 'created',
            actorUserId: ctx.staff.id,
            summary: `Project created from template "${template.name}"`,
            metadata: { templateId: template.id },
          });
        }

        // Determine starting sort offsets so we append to existing content.
        const [existingMilestones, existingTasks] = await Promise.all([
          tx.projectMilestone.count({ where: { projectId, organizationId: ctx.organizationId } }),
          tx.projectTask.count({ where: { projectId, organizationId: ctx.organizationId } }),
        ]);

        let milestoneOrder = existingMilestones;
        let taskOrder = existingTasks;

        for (const milestone of expanded.milestones) {
          const createdMilestone = await tx.projectMilestone.create({
            data: {
              organizationId: ctx.organizationId,
              projectId,
              title: milestone.title,
              description: milestone.description,
              sortOrder: milestoneOrder++,
            },
            select: { id: true },
          });
          for (const task of milestone.tasks) {
            await tx.projectTask.create({
              data: {
                organizationId: ctx.organizationId,
                projectId,
                milestoneId: createdMilestone.id,
                title: task.title,
                description: task.description,
                priority: task.priority,
                estimateHours: task.estimateHours,
                sortOrder: taskOrder++,
                createdByUserId: ctx.staff.id,
              },
            });
          }
        }

        for (const task of expanded.tasks) {
          await tx.projectTask.create({
            data: {
              organizationId: ctx.organizationId,
              projectId,
              title: task.title,
              description: task.description,
              priority: task.priority,
              estimateHours: task.estimateHours,
              sortOrder: taskOrder++,
              createdByUserId: ctx.staff.id,
            },
          });
        }

        await logProjectActivity(tx, {
          organizationId: ctx.organizationId,
          projectId,
          type: 'updated',
          actorUserId: ctx.staff.id,
          summary: `Applied template "${template.name}"`,
          metadata: {
            templateId: template.id,
            milestonesCreated: expanded.milestones.length,
            tasksCreated: countBlueprintTasks(expanded),
          },
        });

        const project = await tx.project.findFirst({
          where: { id: projectId },
          include: {
            owner: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            budget: { select: { id: true, name: true } },
            _count: { select: { tasks: true, milestones: true } },
          },
        });

        return {
          project,
          milestonesCreated: expanded.milestones.length,
          tasksCreated: countBlueprintTasks(expanded),
        };
      });

      if ('notFound' in result) {
        const status = result.notFound === 'Template not found.' ? 404 : 404;
        return NextResponse.json({ error: result.notFound }, { status });
      }

      return NextResponse.json(
        {
          project: result.project ? serializeProject(result.project) : null,
          milestonesCreated: result.milestonesCreated,
          tasksCreated: result.tasksCreated,
        },
        { status: 201 },
      );
    } catch (error) {
      await reportApiError({
        route: 'POST /api/projects/templates/[id]/apply',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to apply template.' }, { status: 500 });
    }
  });
}
