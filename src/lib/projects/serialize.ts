import type {
  Project,
  ProjectMilestone,
  ProjectTask,
  User,
} from '@prisma/client';

type UserPick = Pick<User, 'id' | 'name' | 'email'>;

export function serializeProject(
  row: Project & {
    owner?: UserPick | null;
    createdBy?: UserPick | null;
    budget?: { id: string; name: string } | null;
    _count?: { tasks: number; milestones: number };
  },
) {
  return {
    id: row.id,
    projectCode: row.projectCode,
    name: row.name,
    description: row.description,
    status: row.status,
    department: row.department,
    currency: row.currency,
  budgetAmount: row.budgetAmount != null ? Number(row.budgetAmount) : null,
  budgetId: row.budgetId ?? null,
  budget: row.budget ? { id: row.budget.id, name: row.budget.name } : null,
  startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    owner: row.owner ? { id: row.owner.id, name: row.owner.name } : null,
    createdBy: row.createdBy ? { id: row.createdBy.id, name: row.createdBy.name } : null,
    taskCount: row._count?.tasks ?? undefined,
    milestoneCount: row._count?.milestones ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeMilestone(row: ProjectMilestone & { _count?: { tasks: number } }) {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    sortOrder: row.sortOrder,
    taskCount: row._count?.tasks ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeTask(
  row: ProjectTask & {
    project?: Pick<Project, 'id' | 'projectCode' | 'name'>;
    milestone?: Pick<ProjectMilestone, 'id' | 'title'> | null;
    assignee?: UserPick | null;
  },
) {
  return {
    id: row.id,
    projectId: row.projectId,
    milestoneId: row.milestoneId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    sortOrder: row.sortOrder,
    project: row.project
      ? { id: row.project.id, projectCode: row.project.projectCode, name: row.project.name }
      : undefined,
    milestone: row.milestone ? { id: row.milestone.id, title: row.milestone.title } : null,
    assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
