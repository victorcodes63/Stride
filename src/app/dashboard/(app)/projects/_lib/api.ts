import type {
  ActivityDTO,
  AttachmentDTO,
  CommentDTO,
  DependencyDTO,
  LabelDTO,
  MemberDTO,
  MilestoneDTO,
  ProjectDTO,
  TaskDTO,
} from '@/types/projects';

async function parseJson<T>(r: Response): Promise<T> {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      typeof (data as { error?: string }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${r.status})`,
    );
  }
  return data as T;
}

export async function fetchProjectWorkspace(projectId: string) {
  return parseJson<{ project: ProjectDTO; milestones: MilestoneDTO[]; tasks: TaskDTO[] }>(
    await fetch(`/api/projects/${projectId}`, { credentials: 'include' }),
  );
}

export async function patchProject(projectId: string, body: Record<string, unknown>) {
  return parseJson<{ project: ProjectDTO }>(
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function fetchProjectTasks(params: {
  projectId?: string;
  status?: string;
  include?: string;
}) {
  const q = new URLSearchParams();
  if (params.projectId) q.set('projectId', params.projectId);
  if (params.status) q.set('status', params.status);
  if (params.include) q.set('include', params.include);
  const suffix = q.toString() ? `?${q}` : '';
  return parseJson<{ tasks: TaskDTO[] }>(
    await fetch(`/api/projects/tasks${suffix}`, { credentials: 'include' }),
  );
}

export async function createTask(body: Record<string, unknown>) {
  return parseJson<{ task: TaskDTO }>(
    await fetch('/api/projects/tasks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function patchTask(taskId: string, body: Record<string, unknown>) {
  return parseJson<{ task: TaskDTO }>(
    await fetch(`/api/projects/tasks/${taskId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteTask(taskId: string) {
  return parseJson<{ ok: boolean }>(
    await fetch(`/api/projects/tasks/${taskId}`, {
      method: 'DELETE',
      credentials: 'include',
    }),
  );
}

export async function fetchTaskComments(taskId: string) {
  return parseJson<{ comments: CommentDTO[] }>(
    await fetch(`/api/projects/tasks/${taskId}/comments`, { credentials: 'include' }),
  );
}

export async function createTaskComment(taskId: string, body: string) {
  return parseJson<{ comment: CommentDTO }>(
    await fetch(`/api/projects/tasks/${taskId}/comments`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }),
  );
}

export async function deleteTaskComment(taskId: string, commentId: string) {
  return parseJson<{ ok: boolean }>(
    await fetch(`/api/projects/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
      credentials: 'include',
    }),
  );
}

export async function fetchTaskAttachments(taskId: string) {
  return parseJson<{ attachments: AttachmentDTO[] }>(
    await fetch(`/api/projects/tasks/${taskId}/attachments`, { credentials: 'include' }),
  );
}

export async function uploadTaskAttachment(taskId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return parseJson<{ attachment: AttachmentDTO }>(
    await fetch(`/api/projects/tasks/${taskId}/attachments`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }),
  );
}

export async function deleteTaskAttachment(taskId: string, attachmentId: string) {
  return parseJson<{ ok: boolean }>(
    await fetch(`/api/projects/tasks/${taskId}/attachments/${attachmentId}`, {
      method: 'DELETE',
      credentials: 'include',
    }),
  );
}

export async function fetchTaskDependencies(taskId: string) {
  return parseJson<{
    blocking: (DependencyDTO & { task?: TaskDTO })[];
    blockedBy: (DependencyDTO & { task?: TaskDTO })[];
  }>(await fetch(`/api/projects/tasks/${taskId}/dependencies`, { credentials: 'include' }));
}

export async function addTaskDependency(taskId: string, blockedTaskId: string) {
  return parseJson<{ dependency: DependencyDTO }>(
    await fetch(`/api/projects/tasks/${taskId}/dependencies`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedTaskId }),
    }),
  );
}

export async function removeTaskDependency(taskId: string, dependencyId: string) {
  return parseJson<{ ok: boolean }>(
    await fetch(`/api/projects/tasks/${taskId}/dependencies/${dependencyId}`, {
      method: 'DELETE',
      credentials: 'include',
    }),
  );
}

export async function fetchLabels(projectId?: string) {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return parseJson<{ labels: LabelDTO[] }>(
    await fetch(`/api/projects/labels${q}`, { credentials: 'include' }),
  );
}

export async function createLabel(body: { name: string; color?: string; projectId?: string }) {
  return parseJson<{ label: LabelDTO }>(
    await fetch('/api/projects/labels', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function attachTaskLabel(taskId: string, labelId: string) {
  return parseJson<{ label: LabelDTO }>(
    await fetch(`/api/projects/tasks/${taskId}/labels`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labelId }),
    }),
  );
}

export async function detachTaskLabel(taskId: string, labelId: string) {
  return parseJson<{ ok: boolean }>(
    await fetch(`/api/projects/tasks/${taskId}/labels/${labelId}`, {
      method: 'DELETE',
      credentials: 'include',
    }),
  );
}

export async function fetchMembers(projectId: string) {
  return parseJson<{ members: MemberDTO[] }>(
    await fetch(`/api/projects/${projectId}/members`, { credentials: 'include' }),
  );
}

export async function fetchProjectActivity(projectId: string, opts?: { take?: number; cursor?: string; taskId?: string }) {
  const q = new URLSearchParams();
  if (opts?.take) q.set('take', String(opts.take));
  if (opts?.cursor) q.set('cursor', opts.cursor);
  if (opts?.taskId) q.set('taskId', opts.taskId);
  const suffix = q.toString() ? `?${q}` : '';
  return parseJson<{ activity: ActivityDTO[]; nextCursor: string | null; hasMore: boolean }>(
    await fetch(`/api/projects/${projectId}/activity${suffix}`, { credentials: 'include' }),
  );
}

export async function fetchProjectAttachments(projectId: string) {
  return parseJson<{ attachments: AttachmentDTO[] }>(
    await fetch(`/api/projects/${projectId}/attachments`, { credentials: 'include' }),
  );
}

export async function uploadProjectAttachment(projectId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return parseJson<{ attachment: AttachmentDTO }>(
    await fetch(`/api/projects/${projectId}/attachments`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }),
  );
}

export async function deleteProjectAttachment(projectId: string, attachmentId: string) {
  return parseJson<{ ok: boolean }>(
    await fetch(`/api/projects/${projectId}/attachments/${attachmentId}`, {
      method: 'DELETE',
      credentials: 'include',
    }),
  );
}

export async function createMilestone(body: Record<string, unknown>) {
  return parseJson<{ milestone: MilestoneDTO }>(
    await fetch('/api/projects/milestones', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function patchMilestone(milestoneId: string, body: Record<string, unknown>) {
  return parseJson<{ milestone: MilestoneDTO }>(
    await fetch(`/api/projects/milestones/${milestoneId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function deleteMilestone(milestoneId: string) {
  return parseJson<{ ok: boolean }>(
    await fetch(`/api/projects/milestones/${milestoneId}`, {
      method: 'DELETE',
      credentials: 'include',
    }),
  );
}

export async function fetchProjectBudget(projectId: string) {
  return parseJson<{
    report: {
      utilizationPercent: number;
      totalActual: number;
      remaining: number;
      currency: string;
      budget: { allocated: number; name: string | null };
    };
  }>(await fetch(`/api/projects/${projectId}/budget`, { credentials: 'include' }));
}
