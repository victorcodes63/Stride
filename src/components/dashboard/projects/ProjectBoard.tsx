'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { GripVertical, MessageSquare, Paperclip, Plus, Ban } from 'lucide-react';
import type { TaskDTO } from '@/types/projects';
import type { ProjectTaskStatus } from '@/types/projects';
import {
  TASK_COLUMNS,
  PRIORITY_DOT,
  initials,
  isOverdue,
} from '@/app/dashboard/(app)/projects/_lib/constants';

function CardBody({ task }: { task: TaskDTO }) {
  const overdue = isOverdue(task.dueDate, task.status);
  const subDone = task.subtasks?.filter((s) => s.status === 'done').length;
  const subTotal = task.subtaskCount ?? task.subtasks?.length;
  return (
    <>
      <div className="mb-1 flex items-start gap-2">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium}`}
          aria-hidden
        />
        <p className="text-sm font-medium leading-snug text-[var(--dash-text-strong)]">{task.title}</p>
      </div>
      {task.labels && task.labels.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1 pl-4">
          {task.labels.slice(0, 3).map((l) => (
            <span
              key={l.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: l.color || '#6b7280' }}
            >
              {l.name}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pl-4 text-[11px] text-[var(--dash-text-muted)]">
        {task.project ? <span className="font-mono">{task.project.projectCode}</span> : null}
        {(task.blockedByCount ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-0.5 text-red-600" title="Blocked">
            <Ban className="h-3 w-3" />
            blocked
          </span>
        ) : null}
        {typeof subTotal === 'number' && subTotal > 0 ? (
          <span>
            {subDone ?? 0}/{subTotal}
          </span>
        ) : null}
        {(task.commentCount ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-0.5">
            <MessageSquare className="h-3 w-3" />
            {task.commentCount}
          </span>
        ) : null}
        {(task.attachmentCount ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-0.5">
            <Paperclip className="h-3 w-3" />
            {task.attachmentCount}
          </span>
        ) : null}
        {task.dueDate ? (
          <span className={overdue ? 'font-medium text-red-600' : ''}>due {task.dueDate}</span>
        ) : null}
        {task.assignee ? (
          <span
            className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--stride-coral)] text-[9px] font-semibold text-white"
            title={task.assignee.name}
          >
            {initials(task.assignee.name)}
          </span>
        ) : null}
      </div>
    </>
  );
}

function BoardCard({
  task,
  onClick,
}: {
  task: TaskDTO;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      className={`group rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3 shadow-sm ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-[var(--dash-text-muted)] opacity-0 hover:text-[var(--dash-text-strong)] group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to change status"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          <CardBody task={task} />
        </button>
      </div>
    </div>
  );
}

function BoardColumn({
  status,
  label,
  tasks,
  onCardClick,
  onQuickAdd,
}: {
  status: ProjectTaskStatus;
  label: string;
  tasks: TaskDTO[];
  onCardClick: (id: string) => void;
  onQuickAdd?: (status: ProjectTaskStatus, title: string) => Promise<void> | void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim() || !onQuickAdd) return;
    setSaving(true);
    try {
      await onQuickAdd(status, title.trim());
      setTitle('');
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between rounded-t-lg border-t-2 border-t-[var(--stride-coral)] bg-[var(--dash-surface-muted)] px-3 py-2">
        <span className="text-sm font-semibold text-[var(--dash-text-strong)]">{label}</span>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-[var(--dash-surface-solid)] px-2 py-0.5 text-xs font-medium text-[var(--dash-text-muted)]">
            {tasks.length}
          </span>
          {onQuickAdd ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded p-1 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text-strong)]"
              aria-label={`Add task to ${label}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[8rem] flex-1 flex-col gap-2 rounded-lg p-2 transition-colors ${
          isOver ? 'bg-[var(--brand-primary)]/5 ring-2 ring-[var(--brand-primary)]/30' : 'bg-[var(--dash-surface-muted)]/50'
        }`}
      >
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-2"
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="dash-auth-input w-full text-sm"
              disabled={saving}
            />
            <div className="mt-2 flex gap-1">
              <button type="submit" disabled={saving || !title.trim()} className="dash-auth-submit max-w-[6rem] text-xs">
                {saving ? '…' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setTitle('');
                }}
                className="rounded px-2 text-xs text-[var(--dash-text-muted)]"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
        {tasks.length === 0 && !adding ? (
          <p className="px-2 py-6 text-center text-xs text-[var(--dash-text-muted)]">Drop here</p>
        ) : (
          tasks.map((task) => (
            <BoardCard key={task.id} task={task} onClick={() => onCardClick(task.id)} />
          ))
        )}
      </div>
    </div>
  );
}

export type ProjectBoardProps = {
  tasks: TaskDTO[];
  onCardClick: (taskId: string) => void;
  onStatusChange: (taskId: string, status: ProjectTaskStatus) => void | Promise<void>;
  onQuickAdd?: (status: ProjectTaskStatus, title: string) => void | Promise<void>;
  /** When true, only top-level tasks (no parent) are shown on the board. */
  hideSubtasks?: boolean;
};

export function ProjectBoard({
  tasks,
  onCardClick,
  onStatusChange,
  onQuickAdd,
  hideSubtasks = true,
}: ProjectBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const boardTasks = useMemo(
    () => (hideSubtasks ? tasks.filter((t) => !t.parentTaskId) : tasks),
    [tasks, hideSubtasks],
  );

  const grouped = useMemo(() => {
    const map: Record<ProjectTaskStatus, TaskDTO[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    for (const t of boardTasks) {
      if (map[t.status]) map[t.status].push(t);
      else map.todo.push(t);
    }
    return map;
  }, [boardTasks]);

  const activeTask = activeId ? boardTasks.find((t) => t.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const task = boardTasks.find((t) => t.id === String(active.id));
    const target = String(over.id) as ProjectTaskStatus;
    if (!task || !TASK_COLUMNS.some((c) => c.key === target) || task.status === target) return;
    void onStatusChange(task.id, target);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {TASK_COLUMNS.map((col) => (
          <BoardColumn
            key={col.key}
            status={col.key}
            label={col.label}
            tasks={grouped[col.key]}
            onCardClick={onCardClick}
            onQuickAdd={onQuickAdd}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="w-72 rotate-1 rounded-lg border border-[var(--brand-primary)]/40 bg-[var(--dash-surface-solid)] p-3 shadow-xl">
            <CardBody task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
