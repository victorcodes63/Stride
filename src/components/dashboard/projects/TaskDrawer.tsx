'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Link2,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { DashboardDrawer } from '@/components/dashboard/DashboardDrawer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { ProjectRichText } from '@/components/dashboard/projects/ProjectRichText';
import type {
  AttachmentDTO,
  CommentDTO,
  DependencyDTO,
  LabelDTO,
  MilestoneDTO,
  TaskDTO,
} from '@/types/projects';
import type { ProjectTaskPriority, ProjectTaskStatus } from '@/types/projects';
import {
  attachTaskLabel,
  createLabel,
  createTask,
  createTaskComment,
  deleteTask,
  deleteTaskAttachment,
  deleteTaskComment,
  detachTaskLabel,
  fetchLabels,
  fetchTaskAttachments,
  fetchTaskComments,
  fetchTaskDependencies,
  addTaskDependency,
  removeTaskDependency,
  patchTask,
  uploadTaskAttachment,
} from '@/app/dashboard/(app)/projects/_lib/api';
import {
  PRIORITY_LABEL,
  TASK_COLUMNS,
  TASK_STATUS_STYLES,
} from '@/app/dashboard/(app)/projects/_lib/constants';

export type PersonOption = { id: string; name: string };

export type TaskDrawerProps = {
  open: boolean;
  taskId: string | null;
  /** Seed task from list/board so the drawer paints immediately. */
  seedTask?: TaskDTO | null;
  projectId: string;
  milestones?: MilestoneDTO[];
  projectTasks?: TaskDTO[];
  people?: PersonOption[];
  onClose: () => void;
  onTaskUpdated?: (task: TaskDTO) => void;
  onTaskDeleted?: (taskId: string) => void;
};

export function TaskDrawer({
  open,
  taskId,
  seedTask,
  projectId,
  milestones = [],
  projectTasks = [],
  people = [],
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDrawerProps) {
  const [task, setTask] = useState<TaskDTO | null>(seedTask ?? null);
  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDTO[]>([]);
  const [blocking, setBlocking] = useState<DependencyDTO[]>([]);
  const [blockedBy, setBlockedBy] = useState<DependencyDTO[]>([]);
  const [labels, setLabels] = useState<LabelDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [depTarget, setDepTarget] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadExtras = useCallback(async (id: string) => {
    const [c, a, d, l] = await Promise.all([
      fetchTaskComments(id).catch(() => ({ comments: [] as CommentDTO[] })),
      fetchTaskAttachments(id).catch(() => ({ attachments: [] as AttachmentDTO[] })),
      fetchTaskDependencies(id).catch(() => ({
        blocking: [] as (DependencyDTO & { task?: TaskDTO })[],
        blockedBy: [] as (DependencyDTO & { task?: TaskDTO })[],
      })),
      fetchLabels(projectId).catch(() => ({ labels: [] as LabelDTO[] })),
    ]);
    setComments(c.comments);
    setAttachments(a.attachments);
    setBlocking(d.blocking);
    setBlockedBy(d.blockedBy);
    setLabels(l.labels);
  }, [projectId]);

  useEffect(() => {
    if (!open || !taskId) return;
    setTask(seedTask ?? null);
    setDescription(seedTask?.description ?? '');
    setLoading(true);
    void (async () => {
      try {
        // Prefer seed; refresh via list filter if needed
        if (seedTask && seedTask.id === taskId) {
          setTask(seedTask);
          setDescription(seedTask.description ?? '');
        }
        await loadExtras(taskId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to load task');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, taskId, seedTask, loadExtras]);

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of people) map.set(p.id, p.name);
    if (task?.assignee) map.set(task.assignee.id, task.assignee.name);
    return [
      { value: '', label: 'Unassigned' },
      ...[...map.entries()].map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [people, task?.assignee]);

  const otherTasks = useMemo(
    () => projectTasks.filter((t) => t.id !== taskId && !t.parentTaskId),
    [projectTasks, taskId],
  );

  const taskTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of projectTasks) map.set(t.id, t.title);
    return map;
  }, [projectTasks]);

  function depLabel(dep: DependencyDTO, side: 'blocking' | 'blocked') {
    const id = side === 'blocking' ? dep.blockingTaskId : dep.blockedTaskId;
    return taskTitleById.get(id) ?? id.slice(0, 8);
  }

  async function update(body: Record<string, unknown>) {
    if (!taskId) return;
    setSaving(true);
    try {
      const { task: updated } = await patchTask(taskId, body);
      setTask(updated);
      if (body.description !== undefined) setDescription(updated.description ?? '');
      onTaskUpdated?.(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveDescription() {
    if (!task || description === (task.description ?? '')) return;
    await update({ description: description === '<p></p>' ? '' : description });
  }

  async function addComment() {
    if (!taskId || !commentBody.trim() || commentBody === '<p></p>') return;
    try {
      const { comment } = await createTaskComment(taskId, commentBody);
      setComments((prev) => [...prev, comment]);
      setCommentBody('');
      toast.success('Comment added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to comment');
    }
  }

  async function removeComment(commentId: string) {
    if (!taskId) return;
    try {
      await deleteTaskComment(taskId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete comment');
    }
  }

  async function onUpload(file: File) {
    if (!taskId) return;
    try {
      const { attachment } = await uploadTaskAttachment(taskId, file);
      setAttachments((prev) => [attachment, ...prev]);
      toast.success('Uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    }
  }

  async function removeAttachment(id: string) {
    if (!taskId) return;
    try {
      await deleteTaskAttachment(taskId, id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function addSubtask() {
    if (!taskId || !subtaskTitle.trim()) return;
    try {
      const { task: sub } = await createTask({
        projectId,
        title: subtaskTitle.trim(),
        parentTaskId: taskId,
        status: 'todo',
      });
      setTask((prev) =>
        prev
          ? {
              ...prev,
              subtasks: [...(prev.subtasks ?? []), sub],
              subtaskCount: (prev.subtaskCount ?? 0) + 1,
            }
          : prev,
      );
      setSubtaskTitle('');
      onTaskUpdated?.(task!);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add subtask');
    }
  }

  async function toggleSubtask(sub: TaskDTO) {
    const nextStatus: ProjectTaskStatus = sub.status === 'done' ? 'todo' : 'done';
    try {
      const { task: updated } = await patchTask(sub.id, { status: nextStatus });
      setTask((prev) =>
        prev
          ? {
              ...prev,
              subtasks: (prev.subtasks ?? []).map((s) => (s.id === sub.id ? updated : s)),
            }
          : prev,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update subtask');
    }
  }

  async function addLabelToTask(labelId: string) {
    if (!taskId) return;
    try {
      const { label } = await attachTaskLabel(taskId, labelId);
      setTask((prev) =>
        prev
          ? {
              ...prev,
              labels: [...(prev.labels ?? []).filter((l) => l.id !== label.id), label],
            }
          : prev,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add label');
    }
  }

  async function removeLabel(labelId: string) {
    if (!taskId) return;
    try {
      await detachTaskLabel(taskId, labelId);
      setTask((prev) =>
        prev ? { ...prev, labels: (prev.labels ?? []).filter((l) => l.id !== labelId) } : prev,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove label');
    }
  }

  async function createAndAttachLabel() {
    if (!newLabelName.trim() || !taskId) return;
    try {
      const { label } = await createLabel({ name: newLabelName.trim(), projectId });
      setLabels((prev) => [...prev, label]);
      await addLabelToTask(label.id);
      setNewLabelName('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create label');
    }
  }

  async function addDep() {
    if (!taskId || !depTarget) return;
    try {
      await addTaskDependency(taskId, depTarget);
      const d = await fetchTaskDependencies(taskId);
      setBlocking(d.blocking);
      setBlockedBy(d.blockedBy);
      setDepTarget('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add dependency');
    }
  }

  async function removeDep(dependencyId: string) {
    if (!taskId) return;
    try {
      await removeTaskDependency(taskId, dependencyId);
      setBlocking((prev) => prev.filter((d) => d.id !== dependencyId));
      setBlockedBy((prev) => prev.filter((d) => d.id !== dependencyId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove dependency');
    }
  }

  async function confirmDeleteTask() {
    if (!taskId) return;
    setSaving(true);
    try {
      await deleteTask(taskId);
      toast.success('Task deleted');
      setConfirmDelete(false);
      onTaskDeleted?.(taskId);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  const titleNode = task ? (
    <input
      value={task.title}
      onChange={(e) => setTask({ ...task, title: e.target.value })}
      onBlur={() => {
        if (seedTask && task.title !== seedTask.title) void update({ title: task.title });
        else if (task.title.trim()) void update({ title: task.title });
      }}
      className="w-full border-0 bg-transparent text-lg font-semibold text-[var(--dash-text-strong)] outline-none focus:ring-0"
      aria-label="Task title"
    />
  ) : (
    'Task'
  );

  return (
    <>
      <DashboardDrawer
        open={open && !!taskId}
        onClose={onClose}
        width="lg"
        title={titleNode}
        eyebrow={task?.project ? task.project.projectCode : undefined}
        headerAside={
          task ? (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TASK_STATUS_STYLES[task.status]}`}>
              {task.status.replace('_', ' ')}
            </span>
          ) : null
        }
      >
        {!task && loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--dash-text-muted)]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : task ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <StrideSelect
                  value={task.status}
                  onChange={(v) => void update({ status: v })}
                  options={TASK_COLUMNS.map((c) => ({ value: c.key, label: c.label }))}
                  ariaLabel="Status"
                  className="w-full"
                  size="sm"
                />
              </Field>
              <Field label="Priority">
                <StrideSelect
                  value={task.priority}
                  onChange={(v) => void update({ priority: v as ProjectTaskPriority })}
                  options={(Object.keys(PRIORITY_LABEL) as ProjectTaskPriority[]).map((p) => ({
                    value: p,
                    label: PRIORITY_LABEL[p],
                  }))}
                  ariaLabel="Priority"
                  className="w-full"
                  size="sm"
                />
              </Field>
              <Field label="Assignee">
                <StrideSelect
                  value={task.assignee?.id ?? ''}
                  onChange={(v) => void update({ assigneeUserId: v || null })}
                  options={assigneeOptions}
                  ariaLabel="Assignee"
                  className="w-full"
                  size="sm"
                />
              </Field>
              <Field label="Milestone">
                <StrideSelect
                  value={task.milestoneId ?? ''}
                  onChange={(v) => void update({ milestoneId: v || null })}
                  options={[
                    { value: '', label: 'None' },
                    ...milestones.map((m) => ({ value: m.id, label: m.title })),
                  ]}
                  ariaLabel="Milestone"
                  className="w-full"
                  size="sm"
                />
              </Field>
              <Field label="Start">
                <input
                  type="date"
                  value={task.startDate ?? ''}
                  onChange={(e) => void update({ startDate: e.target.value || null })}
                  className="dash-auth-input w-full text-sm"
                />
              </Field>
              <Field label="Due">
                <input
                  type="date"
                  value={task.dueDate ?? ''}
                  onChange={(e) => void update({ dueDate: e.target.value || null })}
                  className="dash-auth-input w-full text-sm"
                />
              </Field>
              <Field label="Estimate (h)">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={task.estimateHours ?? ''}
                  onChange={(e) =>
                    void update({
                      estimateHours: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="dash-auth-input w-full text-sm"
                />
              </Field>
              <Field label={`Progress (${task.progress}%)`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={task.progress}
                  onChange={(e) => void update({ progress: Number(e.target.value) })}
                  className="w-full"
                />
              </Field>
            </div>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                Description
              </h3>
              <ProjectRichText
                value={description}
                onChange={setDescription}
                onBlur={() => void saveDescription()}
                placeholder="Describe the work…"
              />
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                <CheckSquare className="h-3.5 w-3.5" />
                Subtasks
              </h3>
              <ul className="mb-2 space-y-1">
                {(task.subtasks ?? []).map((sub) => (
                  <li key={sub.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sub.status === 'done'}
                      onChange={() => void toggleSubtask(sub)}
                      className="rounded"
                    />
                    <span className={sub.status === 'done' ? 'text-[var(--dash-text-muted)] line-through' : ''}>
                      {sub.title}
                    </span>
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void addSubtask();
                }}
                className="flex gap-2"
              >
                <input
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  placeholder="Add subtask…"
                  className="dash-auth-input flex-1 text-sm"
                />
                <button type="submit" className="rounded-lg border border-[var(--dash-border)] px-2 py-1 text-sm hover:bg-[var(--dash-hover)]">
                  <Plus className="h-4 w-4" />
                </button>
              </form>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                Labels
              </h3>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(task.labels ?? []).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => void removeLabel(l.id)}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: l.color || '#6b7280' }}
                    title="Remove label"
                  >
                    {l.name}
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <StrideSelect
                  value=""
                  onChange={(v) => {
                    if (v) void addLabelToTask(v);
                  }}
                  options={[
                    { value: '', label: 'Add label…' },
                    ...labels
                      .filter((l) => !(task.labels ?? []).some((t) => t.id === l.id))
                      .map((l) => ({ value: l.id, label: l.name })),
                  ]}
                  ariaLabel="Add label"
                  className="min-w-[10rem]"
                  size="sm"
                />
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void createAndAttachLabel();
                  }}
                  className="flex gap-1"
                >
                  <input
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="New label"
                    className="dash-auth-input w-28 text-sm"
                  />
                  <button type="submit" className="rounded-lg border border-[var(--dash-border)] px-2 text-xs">
                    Create
                  </button>
                </form>
              </div>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                <Link2 className="h-3.5 w-3.5" />
                Dependencies
              </h3>
              {blockedBy.length > 0 ? (
                <div className="mb-2">
                  <p className="mb-1 text-xs text-[var(--dash-text-muted)]">Blocked by</p>
                  <ul className="space-y-1 text-sm">
                    {blockedBy.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2">
                        <span>{depLabel(d, 'blocking')}</span>
                        <button type="button" onClick={() => void removeDep(d.id)} className="text-xs text-red-600">
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {blocking.length > 0 ? (
                <div className="mb-2">
                  <p className="mb-1 text-xs text-[var(--dash-text-muted)]">Blocking</p>
                  <ul className="space-y-1 text-sm">
                    {blocking.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2">
                        <span>{depLabel(d, 'blocked')}</span>
                        <button type="button" onClick={() => void removeDep(d.id)} className="text-xs text-red-600">
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex gap-2">
                <StrideSelect
                  value={depTarget}
                  onChange={setDepTarget}
                  options={[
                    { value: '', label: 'This blocks…' },
                    ...otherTasks.map((t) => ({ value: t.id, label: t.title })),
                  ]}
                  ariaLabel="Dependency target"
                  className="min-w-[12rem] flex-1"
                  size="sm"
                />
                <button
                  type="button"
                  disabled={!depTarget}
                  onClick={() => void addDep()}
                  className="rounded-lg border border-[var(--dash-border)] px-3 text-sm disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                <Paperclip className="h-3.5 w-3.5" />
                Attachments
              </h3>
              <ul className="mb-2 space-y-1 text-sm">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <a href={a.fileUrl} target="_blank" rel="noreferrer" className="truncate text-[var(--brand-primary)] hover:underline">
                      {a.fileName}
                    </a>
                    <button type="button" onClick={() => void removeAttachment(a.id)} className="text-xs text-red-600">
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
              <input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                  e.target.value = '';
                }}
                className="text-sm text-[var(--dash-text-muted)]"
              />
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                Comments
              </h3>
              <ul className="mb-3 max-h-48 space-y-3 overflow-y-auto">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg border border-[var(--dash-border-subtle)] p-2 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--dash-text-strong)]">
                        {c.author?.name ?? 'Someone'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--dash-text-muted)]">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => void removeComment(c.id)}
                          className="text-[var(--dash-text-muted)] hover:text-red-600"
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div
                      className="prose prose-sm max-w-none text-[var(--dash-text-body)]"
                      dangerouslySetInnerHTML={{ __html: c.body }}
                    />
                  </li>
                ))}
                {comments.length === 0 ? (
                  <li className="text-sm text-[var(--dash-text-muted)]">No comments yet.</li>
                ) : null}
              </ul>
              <ProjectRichText
                value={commentBody}
                onChange={setCommentBody}
                placeholder="Write a comment…"
                minHeight={56}
                compact
              />
              <button
                type="button"
                onClick={() => void addComment()}
                disabled={saving}
                className="btn-primary mt-2 inline-flex px-3 py-1.5 text-sm"
              >
                Comment
              </button>
            </section>

            <div className="border-t border-[var(--dash-border)] pt-4">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline"
              >
                <Trash2 className="h-4 w-4" />
                Delete task
              </button>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-[var(--dash-text-muted)]">Task not found.</p>
        )}
      </DashboardDrawer>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this task?"
        description="Subtasks will also be deleted. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={saving}
        onConfirm={() => void confirmDeleteTask()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--dash-text-muted)]">{label}</span>
      {children}
    </label>
  );
}
