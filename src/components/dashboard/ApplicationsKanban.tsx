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
import { Calendar, GripVertical } from 'lucide-react';
import type { ApplicationListItem, ApplicationStatus } from '@/types/dashboard';
import { APPLICATION_STATUS_ORDER, APPLICATION_STATUS_META } from '@/lib/ats-status';

function formatDate(iso: string) {
  const d = new Date(iso);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function CardBody({ app }: { app: ApplicationListItem }) {
  return (
    <>
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-medium text-neutral-800">
          {app.candidate.firstName} {app.candidate.lastName}
        </p>
        {app.viewedByMe === false && (
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-500" title="Not yet viewed" />
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-neutral-500">{app.job.title}</p>
      <p className="truncate text-xs text-neutral-400">{app.job.company}</p>
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-neutral-400">
        <Calendar className="h-3 w-3" />
        {formatDate(app.appliedDate)}
      </p>
    </>
  );
}

function KanbanCard({
  app,
  onClick,
}: {
  app: ApplicationListItem;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id });
  return (
    <div
      ref={setNodeRef}
      className={`group rounded-lg border border-neutral-200 bg-white p-3 shadow-sm ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-neutral-300 hover:text-neutral-500 active:cursor-grabbing"
          aria-label="Drag to change status"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          <CardBody app={app} />
        </button>
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  apps,
  onCardClick,
}: {
  status: ApplicationStatus;
  apps: ApplicationListItem[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = APPLICATION_STATUS_META[status];
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className={`mb-2 flex items-center justify-between rounded-t-lg border-t-2 bg-neutral-50 px-3 py-2 ${meta.columnAccent}`}>
        <span className={`text-sm font-semibold ${meta.columnText}`}>{meta.label}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-neutral-500">
          {apps.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[8rem] flex-1 flex-col gap-2 rounded-lg p-2 transition-colors ${
          isOver ? 'bg-primary-50 ring-2 ring-primary-200' : 'bg-neutral-50/50'
        }`}
      >
        {apps.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-neutral-400">Drop here</p>
        ) : (
          apps.map((app) => (
            <KanbanCard key={app.id} app={app} onClick={() => onCardClick(app.id)} />
          ))
        )}
      </div>
    </div>
  );
}

export function ApplicationsKanban({
  applications,
  onCardClick,
  onStatusChange,
}: {
  applications: ApplicationListItem[];
  onCardClick: (id: string) => void;
  onStatusChange: (app: ApplicationListItem, status: ApplicationStatus) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const grouped = useMemo(() => {
    const map: Record<ApplicationStatus, ApplicationListItem[]> = {
      pending: [],
      reviewed: [],
      shortlisted: [],
      rejected: [],
      hired: [],
    };
    for (const app of applications) map[app.status]?.push(app);
    return map;
  }, [applications]);

  const activeApp = activeId ? applications.find((a) => a.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const app = applications.find((a) => a.id === String(active.id));
    const target = String(over.id) as ApplicationStatus;
    if (!app || !(target in APPLICATION_STATUS_META) || app.status === target) return;
    onStatusChange(app, target);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {APPLICATION_STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            apps={grouped[status]}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeApp ? (
          <div className="w-64 rotate-2 rounded-lg border border-primary-200 bg-white p-3 shadow-xl">
            <CardBody app={activeApp} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
