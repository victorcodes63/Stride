import type {
  Project,
  ProjectActivity,
  ProjectAttachment,
  ProjectComment,
  ProjectLabel,
  ProjectMember,
  ProjectMilestone,
  ProjectTask,
  ProjectTaskDependency,
  ProjectTaskLabel,
  ProjectTaskPriority,
  ProjectTaskStatus,
  ProjectTemplate,
  User,
} from '@prisma/client';

type UserPick = Pick<User, 'id' | 'name' | 'email'>;

export interface SerializedTask {
  id: string;
  projectId: string;
  milestoneId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  progress: number;
  estimateHours: number | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  project?: { id: string; projectCode: string; name: string };
  milestone: { id: string; title: string } | null;
  assignee: { id: string; name: string } | null;
  labels?: ReturnType<typeof serializeLabel>[];
  subtasks?: SerializedTask[];
  subtaskCount?: number;
  commentCount?: number;
  attachmentCount?: number;
  blockingCount?: number;
  blockedByCount?: number;
  createdAt: string;
  updatedAt: string;
}

export function serializeProject(
  row: Project & {
    owner?: UserPick | null;
    createdBy?: UserPick | null;
    budget?: { id: string; name: string } | null;
    _count?: {
      tasks?: number;
      milestones?: number;
      members?: number;
      comments?: number;
      attachments?: number;
    };
  },
) {
  return {
    id: row.id,
    projectCode: row.projectCode,
    name: row.name,
    description: row.description,
    status: row.status,
    health: row.health,
    color: row.color ?? null,
    department: row.department,
    currency: row.currency,
    budgetAmount: row.budgetAmount != null ? Number(row.budgetAmount) : null,
    budgetId: row.budgetId ?? null,
    budget: row.budget ? { id: row.budget.id, name: row.budget.name } : null,
    startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    owner: row.owner ? { id: row.owner.id, name: row.owner.name } : null,
    createdBy: row.createdBy ? { id: row.createdBy.id, name: row.createdBy.name } : null,
    taskCount: row._count?.tasks ?? undefined,
    milestoneCount: row._count?.milestones ?? undefined,
    memberCount: row._count?.members ?? undefined,
    commentCount: row._count?.comments ?? undefined,
    attachmentCount: row._count?.attachments ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeMilestone(
  row: ProjectMilestone & { _count?: { tasks: number } },
) {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status,
    color: row.color ?? null,
    progress: row.progress,
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
    taskLabels?: (ProjectTaskLabel & { label: ProjectLabel })[];
    subtasks?: ProjectTask[];
    _count?: {
      subtasks?: number;
      comments?: number;
      attachments?: number;
      blocking?: number;
      blockedBy?: number;
    };
  },
): SerializedTask {
  return {
    id: row.id,
    projectId: row.projectId,
    milestoneId: row.milestoneId,
    parentTaskId: row.parentTaskId ?? null,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    progress: row.progress,
    estimateHours: row.estimateHours != null ? Number(row.estimateHours) : null,
    startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    sortOrder: row.sortOrder,
    project: row.project
      ? { id: row.project.id, projectCode: row.project.projectCode, name: row.project.name }
      : undefined,
    milestone: row.milestone ? { id: row.milestone.id, title: row.milestone.title } : null,
    assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.name } : null,
    labels: row.taskLabels ? row.taskLabels.map((tl) => serializeLabel(tl.label)) : undefined,
    subtasks: row.subtasks ? row.subtasks.map((s) => serializeTask(s)) : undefined,
    subtaskCount: row._count?.subtasks ?? undefined,
    commentCount: row._count?.comments ?? undefined,
    attachmentCount: row._count?.attachments ?? undefined,
    blockingCount: row._count?.blocking ?? undefined,
    blockedByCount: row._count?.blockedBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeMember(row: ProjectMember & { user?: UserPick | null }) {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    role: row.role,
    user: row.user
      ? { id: row.user.id, name: row.user.name, email: row.user.email }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeLabel(row: ProjectLabel) {
  return {
    id: row.id,
    projectId: row.projectId ?? null,
    name: row.name,
    color: row.color,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeComment(row: ProjectComment & { author?: UserPick | null }) {
  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId ?? null,
    authorUserId: row.authorUserId,
    author: row.author ? { id: row.author.id, name: row.author.name } : null,
    body: row.body,
    mentions: row.mentions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeAttachment(
  row: ProjectAttachment & { uploadedBy?: UserPick | null },
) {
  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId ?? null,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    fileSize: row.fileSize ?? null,
    contentType: row.contentType ?? null,
    uploadedByUserId: row.uploadedByUserId,
    uploadedBy: row.uploadedBy
      ? { id: row.uploadedBy.id, name: row.uploadedBy.name }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeActivity(row: ProjectActivity & { actor?: UserPick | null }) {
  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId ?? null,
    type: row.type,
    actorUserId: row.actorUserId ?? null,
    actor: row.actor ? { id: row.actor.id, name: row.actor.name } : null,
    summary: row.summary,
    metadata: (row.metadata ?? null) as unknown,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeDependency(row: ProjectTaskDependency) {
  return {
    id: row.id,
    blockingTaskId: row.blockingTaskId,
    blockedTaskId: row.blockedTaskId,
    createdByUserId: row.createdByUserId ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeTemplate(row: ProjectTemplate) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    blueprint: row.blueprint as unknown,
    createdByUserId: row.createdByUserId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
