import { NextRequest, NextResponse } from 'next/server';
import { WorkflowStatus } from '@prisma/client';
import { withEssTenant } from '@/lib/ess-tenant-api';

const OPEN_STATUSES = new Set(['COMPLETED', 'SKIPPED']);

function isOpenStatus(status: string) {
  return !OPEN_STATUSES.has(status);
}

/**
 * Whole days from now until `date`. Positive = in the future ("starts in N"),
 * negative = in the past ("started N days ago"), 0 = today.
 */
function countdownDays(date: Date | null): number | null {
  if (!date) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(date);
  startOfTarget.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / msPerDay);
}

export type EssOnboardingWelcomePayload = {
  employee: {
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    dateOfJoining: string | null;
    departmentName: string | null;
    manager: {
      firstName: string;
      lastName: string;
      jobTitle: string | null;
    } | null;
  } | null;
  organization: { name: string } | null;
  progress: {
    total: number;
    completed: number;
    percent: number;
    countdownDays: number | null;
    workflowStatus: string | null;
    templateName: string | null;
  };
};

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    const emptyProgress: EssOnboardingWelcomePayload['progress'] = {
      total: 0,
      completed: 0,
      percent: 0,
      countdownDays: null,
      workflowStatus: null,
      templateName: null,
    };

    if (!ctx.employeeId) {
      return NextResponse.json<EssOnboardingWelcomePayload>({
        employee: null,
        organization: null,
        progress: emptyProgress,
      });
    }

    const [employee, workflow, organization] = await ctx.run(async (tx) => {
      const employeeRow = await tx.employee.findUnique({
        where: { id: ctx.employeeId! },
        select: {
          firstName: true,
          lastName: true,
          jobTitle: true,
          dateOfJoining: true,
          department: { select: { name: true } },
          manager: {
            select: { firstName: true, lastName: true, jobTitle: true },
          },
        },
      });

      const workflowRow = await tx.onboardingWorkflow.findFirst({
        where: {
          ...ctx.where(),
          employeeId: ctx.employeeId!,
          type: 'ONBOARDING',
          status: WorkflowStatus.IN_PROGRESS,
        },
        include: {
          tasks: { select: { status: true } },
          template: { select: { name: true } },
        },
      });

      // Organization branding is best-effort; RLS may restrict this read.
      let organizationRow: { name: string } | null = null;
      try {
        organizationRow = await tx.organization.findUnique({
          where: { id: ctx.organizationId },
          select: { name: true },
        });
      } catch {
        organizationRow = null;
      }

      return [employeeRow, workflowRow, organizationRow] as const;
    });

    const dateOfJoining = employee?.dateOfJoining ?? null;

    const progress: EssOnboardingWelcomePayload['progress'] = workflow
      ? (() => {
          const total = workflow.tasks.length;
          const completed = workflow.tasks.filter((t) => !isOpenStatus(t.status)).length;
          const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
          return {
            total,
            completed,
            percent,
            countdownDays: countdownDays(dateOfJoining),
            workflowStatus: workflow.status,
            templateName: workflow.template?.name ?? null,
          };
        })()
      : { ...emptyProgress, countdownDays: countdownDays(dateOfJoining) };

    return NextResponse.json<EssOnboardingWelcomePayload>({
      employee: employee
        ? {
            firstName: employee.firstName,
            lastName: employee.lastName,
            jobTitle: employee.jobTitle,
            dateOfJoining: dateOfJoining ? dateOfJoining.toISOString() : null,
            departmentName: employee.department?.name ?? null,
            manager: employee.manager
              ? {
                  firstName: employee.manager.firstName,
                  lastName: employee.manager.lastName,
                  jobTitle: employee.manager.jobTitle,
                }
              : null,
          }
        : null,
      organization: organization ? { name: organization.name } : null,
      progress,
    });
  });
}
