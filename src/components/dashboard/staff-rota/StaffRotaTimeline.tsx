'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle } from 'lucide-react';
import type { StaffAssignment, StaffSubject } from './types';
import {
  TIMELINE_DAY_WIDTH,
  formatShiftRangeCompact,
  groupSubjectsByDepartment,
  packSubjectBars,
  shortDate,
} from './helpers';

const LANE_H = 30;
const BAR_H = 26;
const DRAW_SNAP = 15; // minutes

type DayTotal = { shifts: number; hours: number; staff: number };

type Props = {
  subjects: StaffSubject[];
  assignmentsBySubject: Map<string, StaffAssignment[]>;
  weekDays: string[];
  dayTotals: Record<string, DayTotal>;
  holidays: Map<string, string>;
  coverageTarget: number;
  conflictAssignmentIds: Set<string>;
  templateColorById: Map<string, string>;
  selectedIds: string[];
  readOnly: boolean;
  onToggleSelect: (userId: string, checked: boolean) => void;
  onEditShift: (assignment: StaffAssignment) => void;
  onMoveShift: (assignment: StaffAssignment, target: { userId: string; workDate: string }) => void;
  onDrawCreate: (target: { userId: string; workDate: string; startMinutes: number; endMinutes: number }) => void;
};

function parseCellId(id: string): { userId: string; day: string } | null {
  if (!id.startsWith('cell:')) return null;
  const rest = id.slice(5);
  const idx = rest.lastIndexOf(':');
  if (idx < 0) return null;
  return { userId: rest.slice(0, idx), day: rest.slice(idx + 1) };
}

function ShiftBar({
  assignment,
  startHourOffset,
  endHourOffset,
  lane,
  color,
  conflict,
  readOnly,
  onEdit,
}: {
  assignment: StaffAssignment;
  startHourOffset: number;
  endHourOffset: number;
  lane: number;
  color: string;
  conflict: boolean;
  readOnly: boolean;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bar:${assignment.id}`,
    data: { assignment },
    disabled: readOnly,
  });
  const left = (startHourOffset / 24) * TIMELINE_DAY_WIDTH + 2;
  const width = Math.max(10, ((endHourOffset - startHourOffset) / 24) * TIMELINE_DAY_WIDTH - 4);
  const label = formatShiftRangeCompact(assignment.startsAt, assignment.endsAt);
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging) onEdit();
      }}
      {...listeners}
      {...attributes}
      title={`${assignment.shiftTemplate?.name ? `${assignment.shiftTemplate.name} · ` : ''}${label}${
        assignment.notes ? ` · ${assignment.notes}` : ''
      }`}
      className={`absolute flex touch-none items-center gap-1 overflow-hidden rounded-md border px-1.5 text-left font-medium tabular-nums tracking-tight text-neutral-900 shadow-sm ${
        readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      } ${conflict ? 'border-amber-500 ring-1 ring-amber-400' : 'border-black/10'} ${
        width < 78 ? 'text-[9px]' : 'text-[10px]'
      }`}
      style={{
        left,
        width,
        top: 6 + lane * LANE_H,
        height: BAR_H,
        backgroundColor: color,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : 1,
        opacity: isDragging ? 0.85 : 1,
      }}
    >
      {conflict ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber-700" aria-hidden /> : null}
      <span className="truncate">{label}</span>
    </button>
  );
}

function DayCell({
  userId,
  day,
  rowHeight,
  isHoliday,
  bars,
  templateColorById,
  conflictAssignmentIds,
  readOnly,
  onEditShift,
  onDrawCreate,
}: {
  userId: string;
  day: string;
  rowHeight: number;
  isHoliday: boolean;
  bars: { assignment: StaffAssignment; startHourOffset: number; endHourOffset: number; lane: number }[];
  templateColorById: Map<string, string>;
  conflictAssignmentIds: Set<string>;
  readOnly: boolean;
  onEditShift: (a: StaffAssignment) => void;
  onDrawCreate: (t: { userId: string; workDate: string; startMinutes: number; endMinutes: number }) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${userId}:${day}` });
  const cellRef = useRef<HTMLDivElement | null>(null);
  const [draw, setDraw] = useState<{ x0: number; x1: number } | null>(null);
  const drawStateRef = useRef<{ left: number; width: number; x0: number } | null>(null);

  const xToMinutes = useCallback((clientX: number, rect: { left: number; width: number }) => {
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round((ratio * 1440) / DRAW_SNAP) * DRAW_SNAP;
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    if (e.button !== 0) return;
    // Ignore clicks that land on a shift bar (they handle their own drag).
    if ((e.target as HTMLElement).closest('[data-shift-bar]')) return;
    const el = cellRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drawStateRef.current = { left: rect.left, width: rect.width, x0: e.clientX - rect.left };
    setDraw({ x0: e.clientX - rect.left, x1: e.clientX - rect.left });

    const move = (ev: PointerEvent) => {
      const s = drawStateRef.current;
      if (!s) return;
      setDraw({ x0: s.x0, x1: Math.min(s.width, Math.max(0, ev.clientX - s.left)) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const s = drawStateRef.current;
      drawStateRef.current = null;
      setDraw(null);
      if (!s) return;
      const startMin = xToMinutes(s.left + s.x0, { left: s.left, width: s.width });
      const endMin = xToMinutes(ev.clientX, { left: s.left, width: s.width });
      const lo = Math.min(startMin, endMin);
      const hi = Math.max(startMin, endMin);
      if (hi - lo >= 30) {
        onDrawCreate({ userId, workDate: day, startMinutes: lo, endMinutes: Math.min(1440, hi) });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        cellRef.current = node;
      }}
      onPointerDown={onPointerDown}
      className={`relative border-l border-neutral-100 ${isHoliday ? 'bg-amber-50/50' : 'bg-neutral-50/30'} ${
        isOver ? 'ring-2 ring-inset ring-primary-300' : ''
      } ${readOnly ? '' : 'cursor-crosshair'}`}
      style={{ width: TIMELINE_DAY_WIDTH, minWidth: TIMELINE_DAY_WIDTH, height: rowHeight }}
    >
      {bars.map((b) => (
        <span key={b.assignment.id} data-shift-bar>
          <ShiftBar
            assignment={b.assignment}
            startHourOffset={b.startHourOffset}
            endHourOffset={b.endHourOffset}
            lane={b.lane}
            color={b.assignment.staffShiftTemplateId ? templateColorById.get(b.assignment.staffShiftTemplateId) ?? '#c7d2fe' : '#e5e7eb'}
            conflict={conflictAssignmentIds.has(b.assignment.id)}
            readOnly={readOnly}
            onEdit={() => onEditShift(b.assignment)}
          />
        </span>
      ))}
      {draw ? (
        <div
          className="pointer-events-none absolute top-1 rounded-md border-2 border-dashed border-primary-400 bg-primary-100/50"
          style={{
            left: Math.min(draw.x0, draw.x1),
            width: Math.abs(draw.x1 - draw.x0),
            height: rowHeight - 8,
          }}
        />
      ) : null}
    </div>
  );
}

export function StaffRotaTimeline({
  subjects,
  assignmentsBySubject,
  weekDays,
  dayTotals,
  holidays,
  coverageTarget,
  conflictAssignmentIds,
  templateColorById,
  selectedIds,
  readOnly,
  onToggleSelect,
  onEditShift,
  onMoveShift,
  onDrawCreate,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const groups = useMemo(() => groupSubjectsByDepartment(subjects), [subjects]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const packedBySubject = useMemo(() => {
    const map = new Map<string, ReturnType<typeof packSubjectBars>>();
    for (const s of subjects) {
      map.set(s.id, packSubjectBars(assignmentsBySubject.get(s.id) ?? [], weekDays));
    }
    return map;
  }, [subjects, assignmentsBySubject, weekDays]);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over) return;
      const assignment = (active.data.current?.assignment as StaffAssignment | undefined) ?? null;
      const target = parseCellId(String(over.id));
      if (!assignment || !target) return;
      const currentDay = new Date(assignment.workDate);
      const currentYmd = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
      if (target.userId === assignment.userId && target.day === currentYmd) return;
      onMoveShift(assignment, { userId: target.userId, workDate: target.day });
    },
    [onMoveShift],
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="max-h-[min(620px,calc(100vh-15rem))] overflow-auto rounded-lg border border-neutral-200 bg-white [scrollbar-gutter:stable]">
        <div style={{ minWidth: `calc(15rem + ${TIMELINE_DAY_WIDTH * 7}px)` }}>
          {/* Header */}
          <div className="sticky top-0 z-30 flex border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-600">
            <div className="sticky left-0 z-40 w-60 shrink-0 border-r border-neutral-200 bg-neutral-50 px-3 py-2 font-semibold text-neutral-800">
              Staff
            </div>
            <div className="flex shrink-0" style={{ width: TIMELINE_DAY_WIDTH * 7 }}>
              {weekDays.map((d) => {
                const total = dayTotals[d] ?? { shifts: 0, hours: 0, staff: 0 };
                const understaffed = coverageTarget > 0 && total.staff < coverageTarget;
                return (
                  <div
                    key={`head-${d}`}
                    className={`border-l border-neutral-200 px-2 py-2 ${understaffed ? 'bg-red-50' : total.staff > 0 ? 'bg-emerald-50/40' : ''}`}
                    style={{ width: TIMELINE_DAY_WIDTH, minWidth: TIMELINE_DAY_WIDTH }}
                  >
                    <div className="font-medium text-neutral-800">{shortDate(d)}</div>
                    {holidays.get(d) ? (
                      <div className="truncate text-[10px] font-medium text-amber-700">{holidays.get(d)}</div>
                    ) : null}
                    <div className={`text-[10px] ${understaffed ? 'font-semibold text-red-600' : 'text-neutral-500'}`}>
                      {total.staff} staff · {total.hours.toFixed(1)}h
                      {understaffed ? ` · needs ${coverageTarget}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Body grouped by department */}
          {groups.map((group) => (
            <div key={group.department}>
              <div className="sticky left-0 z-20 flex items-center gap-2 border-b border-neutral-200 bg-neutral-100/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 backdrop-blur">
                {group.department}
                <span className="rounded-full bg-white px-1.5 text-[10px] font-medium text-neutral-500">
                  {group.members.length}
                </span>
              </div>
              {group.members.map((subject) => {
                const packed = packedBySubject.get(subject.id) ?? { bars: [], laneCount: 1 };
                const rowHeight = Math.max(48, packed.laneCount * LANE_H + 12);
                const barsByDay = new Map<number, typeof packed.bars>();
                for (const b of packed.bars) {
                  const arr = barsByDay.get(b.dayIndex) ?? [];
                  arr.push(b);
                  barsByDay.set(b.dayIndex, arr);
                }
                return (
                  <div key={subject.id} className="flex border-b border-neutral-100 text-xs">
                    <div className="sticky left-0 z-10 flex w-60 shrink-0 items-start gap-2 border-r border-neutral-200 bg-white px-3 py-2 shadow-[4px_0_8px_-6px_rgba(0,0,0,0.12)]">
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0"
                        checked={selected.has(subject.id)}
                        onChange={(ev) => onToggleSelect(subject.id, ev.target.checked)}
                        aria-label={`Select ${subject.name}`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-neutral-800">{subject.name}</span>
                        <span className="block truncate text-[10px] text-neutral-400">{subject.policy.label}</span>
                      </span>
                    </div>
                    <div className="flex shrink-0" style={{ width: TIMELINE_DAY_WIDTH * 7 }}>
                      {weekDays.map((day, dayIndex) => (
                        <DayCell
                          key={`${subject.id}-${day}`}
                          userId={subject.id}
                          day={day}
                          rowHeight={rowHeight}
                          isHoliday={holidays.has(day)}
                          bars={barsByDay.get(dayIndex) ?? []}
                          templateColorById={templateColorById}
                          conflictAssignmentIds={conflictAssignmentIds}
                          readOnly={readOnly}
                          onEditShift={onEditShift}
                          onDrawCreate={onDrawCreate}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {subjects.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-neutral-500">No staff match your filters.</div>
          ) : null}
        </div>
      </div>
      {!readOnly ? (
        <p className="mt-1.5 text-[11px] text-neutral-400">
          Tip: drag a shift to move it (across days or people). Drag across an empty lane to draw a new shift.
        </p>
      ) : null}
    </DndContext>
  );
}
