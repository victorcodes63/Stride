import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { XLSX_CONTENT_TYPE } from '@/lib/excel-export';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/** Export projects + tasks as a multi-sheet Excel workbook. */
export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    try {
      const { projects, tasks } = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        const projectRows = await tx.project.findMany({
          where: { organizationId: ctx.organizationId, outsourcingClientId: clientId },
          include: {
            owner: { select: { name: true, email: true } },
            _count: { select: { tasks: true, milestones: true } },
          },
          orderBy: [{ status: 'asc' }, { name: 'asc' }],
          take: 500,
        });
        const taskRows = await tx.projectTask.findMany({
          where: {
            organizationId: ctx.organizationId,
            project: { outsourcingClientId: clientId },
            parentTaskId: null,
          },
          include: {
            project: { select: { projectCode: true, name: true } },
            assignee: { select: { name: true } },
            milestone: { select: { title: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
          take: 5000,
        });
        return { projects: projectRows, tasks: taskRows };
      });

      const projectHeaders = [
        'Code',
        'Name',
        'Status',
        'Health',
        'Department',
        'Owner',
        'Start',
        'Due',
        'Tasks',
        'Milestones',
        'Currency',
        'Budget amount',
      ];
      const projectRows = projects.map((p) => [
        p.projectCode,
        p.name,
        p.status,
        p.health,
        p.department,
        p.owner?.name ?? '',
        p.startDate?.toISOString().slice(0, 10) ?? '',
        p.dueDate?.toISOString().slice(0, 10) ?? '',
        p._count.tasks,
        p._count.milestones,
        p.currency,
        p.budgetAmount != null ? Number(p.budgetAmount) : '',
      ]);

      const taskHeaders = [
        'Project code',
        'Project',
        'Task',
        'Status',
        'Priority',
        'Assignee',
        'Milestone',
        'Start',
        'Due',
        'Estimate (h)',
        'Progress %',
        'Completed',
      ];
      const taskData = tasks.map((t) => [
        t.project?.projectCode ?? '',
        t.project?.name ?? '',
        t.title,
        t.status,
        t.priority,
        t.assignee?.name ?? '',
        t.milestone?.title ?? '',
        t.startDate?.toISOString().slice(0, 10) ?? '',
        t.dueDate?.toISOString().slice(0, 10) ?? '',
        t.estimateHours != null ? Number(t.estimateHours) : '',
        t.progress,
        t.completedAt?.toISOString().slice(0, 10) ?? '',
      ]);

      // toXlsx is single-sheet; build a combined workbook with ExcelJS via two calls
      // by concatenating sheets manually for a richer export.
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Stride';
      workbook.created = new Date();

      const addSheet = (name: string, headers: string[], rows: (string | number)[][]) => {
        const sheet = workbook.addWorksheet(name.slice(0, 31), {
          views: [{ state: 'frozen', ySplit: 1 }],
        });
        sheet.addRow(headers);
        for (const row of rows) sheet.addRow(row);
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0F2A3D' },
          };
        });
        headers.forEach((h, i) => {
          sheet.getColumn(i + 1).width = Math.min(40, Math.max(12, h.length + 4));
        });
      };

      addSheet('Projects', projectHeaders, projectRows as (string | number)[][]);
      addSheet('Tasks', taskHeaders, taskData as (string | number)[][]);

      const buffer = await workbook.xlsx.writeBuffer();
      const stamp = new Date().toISOString().slice(0, 10);

      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Type': XLSX_CONTENT_TYPE,
          'Content-Disposition': `attachment; filename="stride-projects-${stamp}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/projects/export',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to export projects.' }, { status: 500 });
    }
  });
}
