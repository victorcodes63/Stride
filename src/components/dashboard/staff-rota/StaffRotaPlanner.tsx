'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileSpreadsheet,
  LayoutGrid,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Rows3,
  ScanSearch,
  Zap,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { StrideSelect } from '@/components/ui/stride-select';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { toast } from '@/components/ui/toast';
import { StaffRotaTimeline } from './StaffRotaTimeline';
import type {
  ImportPreviewRow,
  OperationResult,
  StaffAssignment,
  StaffRotaConflict,
  StaffRotaPeriod,
  StaffShiftTemplate,
  StaffSubject,
} from './types';
import {
  addDays,
  fmtMinutes,
  formatShiftRangeCompact,
  hoursBetween,
  isoForDayTime,
  localHm,
  localMinutes,
  shortDate,
  startOfWeek,
  toYmd,
} from './helpers';

type ApiResult<T> = { ok: boolean; status: number; data: T & { conflicts?: StaffRotaConflict[]; error?: string } };

const DEFAULT_TEMPLATE_DRAFT = {
  name: '',
  startHm: '08:00',
  endHm: '17:00',
  breakMinutes: 60,
  color: '#1d4ed8',
};

const TEMPLATE_COLORS = ['#1d4ed8', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04', '#475569'];

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

async function apiFetch<T = Record<string, unknown>>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(input, { cache: 'no-store', ...init });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as ApiResult<T>['data'] };
}

export function StaffRotaPlanner() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  const [subjects, setSubjects] = useState<StaffSubject[]>([]);
  const [templates, setTemplates] = useState<StaffShiftTemplate[]>([]);
  const [periods, setPeriods] = useState<StaffRotaPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [conflicts, setConflicts] = useState<StaffRotaConflict[]>([]);

  const [view, setView] = useState<'timeline' | 'table'>('timeline');
  const [weekAnchorDate, setWeekAnchorDate] = useState('');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [coverageTarget, setCoverageTarget] = useState(0);
  const [lastResult, setLastResult] = useState<OperationResult | null>(null);

  const [templateDraft, setTemplateDraft] = useState(DEFAULT_TEMPLATE_DRAFT);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [periodDraft, setPeriodDraft] = useState({ name: '', startDate: '', endDate: '' });

  const [brushTemplateId, setBrushTemplateId] = useState('');
  const [bulkTemplateId, setBulkTemplateId] = useState('');

  const [editing, setEditing] = useState<StaffAssignment | null>(null);
  const [editDraft, setEditDraft] = useState({ workDate: '', startHm: '08:00', endHm: '17:00', breakMinutes: 0, notes: '' });

  const [holidays, setHolidays] = useState<Map<string, string>>(new Map());
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ parseErrors?: Array<{ row: number; message: string }>; rows?: ImportPreviewRow[] } | null>(null);

  const selectedPeriod = useMemo(() => periods.find((p) => p.id === selectedPeriodId) ?? null, [periods, selectedPeriodId]);
  const isPublished = selectedPeriod?.status === 'published';
  const locked = readOnly || isPublished;

  const weekDays = useMemo(() => {
    const anchor = weekAnchorDate || selectedPeriod?.startDate?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedPeriod?.startDate, weekAnchorDate]);

  const activeTemplates = useMemo(() => templates.filter((t) => t.isActive), [templates]);

  const templateColorById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of templates) if (t.color) m.set(t.id, t.color);
    return m;
  }, [templates]);

  const filteredSubjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => `${s.name} ${s.email} ${s.department ?? ''}`.toLowerCase().includes(q));
  }, [subjects, search]);

  const assignmentsBySubject = useMemo(() => {
    const m = new Map<string, StaffAssignment[]>();
    for (const a of assignments) {
      const arr = m.get(a.userId) ?? [];
      arr.push(a);
      m.set(a.userId, arr);
    }
    return m;
  }, [assignments]);

  const assignmentsByKey = useMemo(() => {
    const m = new Map<string, StaffAssignment[]>();
    for (const a of assignments) {
      const key = `${a.userId}|${toYmd(a.workDate)}`;
      const arr = m.get(key) ?? [];
      arr.push(a);
      m.set(key, arr);
    }
    return m;
  }, [assignments]);

  const dayTotals = useMemo(() => {
    const out: Record<string, { shifts: number; hours: number; staff: number }> = {};
    const staffByDay: Record<string, Set<string>> = {};
    for (const d of weekDays) {
      out[d] = { shifts: 0, hours: 0, staff: 0 };
      staffByDay[d] = new Set();
    }
    for (const a of assignments) {
      const d = toYmd(a.workDate);
      if (!out[d]) continue;
      out[d]!.shifts += 1;
      out[d]!.hours += hoursBetween(a.startsAt, a.endsAt, a.breakMinutes);
      staffByDay[d]!.add(a.userId);
    }
    for (const d of weekDays) out[d]!.staff = staffByDay[d]!.size;
    return out;
  }, [assignments, weekDays]);

  const conflictAssignmentIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflicts) for (const id of c.assignmentIds) s.add(id);
    return s;
  }, [conflicts]);

  const conflictsByUser = useMemo(() => {
    const m = new Map<string, StaffRotaConflict[]>();
    for (const c of conflicts) {
      if (!c.userId) continue;
      const arr = m.get(c.userId) ?? [];
      arr.push(c);
      m.set(c.userId, arr);
    }
    return m;
  }, [conflicts]);

  const coverageConflicts = useMemo(() => conflicts.filter((c) => c.type === 'coverage_understaffed'), [conflicts]);

  // ---- loaders --------------------------------------------------------------
  const loadCore = useCallback(async () => {
    const [subRes, tRes, pRes] = await Promise.all([
      apiFetch<StaffSubject[]>('/api/staff/rota/subjects'),
      apiFetch<StaffShiftTemplate[]>('/api/staff/rota/templates?all=1'),
      apiFetch<StaffRotaPeriod[]>('/api/staff/rota/periods'),
    ]);
    if (subRes.ok) setSubjects(subRes.data as unknown as StaffSubject[]);
    if (tRes.ok) setTemplates(tRes.data as unknown as StaffShiftTemplate[]);
    if (pRes.ok) {
      const list = pRes.data as unknown as StaffRotaPeriod[];
      setPeriods(list);
      setSelectedPeriodId((pid) => (pid && list.some((p) => p.id === pid) ? pid : list[0]?.id ?? ''));
    }
  }, []);

  const loadAssignments = useCallback(async (periodId: string) => {
    if (!periodId) {
      setAssignments([]);
      return;
    }
    const res = await apiFetch<StaffAssignment[]>(`/api/staff/rota/assignments?rotaPeriodId=${encodeURIComponent(periodId)}`);
    if (res.ok) setAssignments(res.data as unknown as StaffAssignment[]);
  }, []);

  const scanConflicts = useCallback(
    async (periodId: string, silent = false) => {
      if (!periodId) return;
      const url = `/api/staff/rota/conflicts?rotaPeriodId=${encodeURIComponent(periodId)}${coverageTarget > 0 ? `&minPerDay=${coverageTarget}` : ''}`;
      const res = await apiFetch<{ conflicts: StaffRotaConflict[] }>(url);
      if (res.ok) {
        setConflicts(res.data.conflicts ?? []);
        if (!silent) {
          const errs = (res.data.conflicts ?? []).filter((c) => c.severity === 'error').length;
          toast[errs > 0 ? 'warning' : 'success'](
            errs > 0 ? `${errs} blocking conflict${errs === 1 ? '' : 's'} found` : 'No blocking conflicts',
          );
        }
      }
    },
    [coverageTarget],
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadCore();
    } finally {
      setLoading(false);
    }
  }, [loadCore]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!selectedPeriodId) {
      setAssignments([]);
      setConflicts([]);
      return;
    }
    setBusy(true);
    void Promise.all([loadAssignments(selectedPeriodId), scanConflicts(selectedPeriodId, true)]).finally(() => setBusy(false));
  }, [selectedPeriodId, loadAssignments, scanConflicts]);

  useEffect(() => {
    const y = new Date(`${weekDays[0]}T00:00:00.000Z`).getUTCFullYear();
    void (async () => {
      const res = await apiFetch<Array<{ date: string; name: string }>>(`/api/admin/holidays/year/${y}`);
      if (!res.ok || !Array.isArray(res.data)) return;
      const m = new Map<string, string>();
      for (const item of res.data as unknown as Array<{ date: string; name: string }>) m.set(item.date.slice(0, 10), item.name);
      setHolidays(m);
    })();
  }, [weekDays]);

  const guardWrite = useCallback((res: ApiResult<unknown>): boolean => {
    if (res.status === 403) {
      setReadOnly(true);
      toast.error('You have read-only access to the rota.');
      return false;
    }
    return true;
  }, []);

  // ---- templates ------------------------------------------------------------
  async function saveTemplate() {
    if (!templateDraft.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: templateDraft.name.trim(),
        startMinutes: hmToMinutes(templateDraft.startHm),
        endMinutes: hmToMinutes(templateDraft.endHm),
        breakMinutes: templateDraft.breakMinutes,
        color: templateDraft.color,
      };
      const res = editingTemplateId
        ? await apiFetch(`/api/staff/rota/templates/${editingTemplateId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await apiFetch('/api/staff/rota/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        if (guardWrite(res)) toast.error(res.data.error || 'Failed to save template');
        return;
      }
      toast.success(editingTemplateId ? 'Template updated' : 'Template created');
      setTemplateDraft(DEFAULT_TEMPLATE_DRAFT);
      setEditingTemplateId(null);
      const t = await apiFetch<StaffShiftTemplate[]>('/api/staff/rota/templates?all=1');
      if (t.ok) setTemplates(t.data as unknown as StaffShiftTemplate[]);
    } finally {
      setBusy(false);
    }
  }

  function startEditTemplate(t: StaffShiftTemplate) {
    setEditingTemplateId(t.id);
    setTemplateDraft({
      name: t.name,
      startHm: fmtMinutes(t.startMinutes),
      endHm: fmtMinutes(t.endMinutes),
      breakMinutes: t.breakMinutes,
      color: t.color || '#1d4ed8',
    });
  }

  async function deleteTemplate(id: string) {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/staff/rota/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        if (guardWrite(res)) toast.error(res.data.error || 'Failed to delete template');
        return;
      }
      toast.success('Template deleted');
      if (editingTemplateId === id) {
        setEditingTemplateId(null);
        setTemplateDraft(DEFAULT_TEMPLATE_DRAFT);
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setBusy(false);
    }
  }

  // ---- periods --------------------------------------------------------------
  async function createPeriod() {
    if (!periodDraft.startDate || !periodDraft.endDate) {
      toast.error('Start and end dates are required');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<StaffRotaPeriod>('/api/staff/rota/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: periodDraft.name.trim() || null,
          startDate: periodDraft.startDate,
          endDate: periodDraft.endDate,
        }),
      });
      if (!res.ok) {
        if (guardWrite(res)) toast.error(res.data.error || 'Failed to create period');
        return;
      }
      const created = res.data as unknown as StaffRotaPeriod;
      toast.success('Rota period created');
      setPeriodDraft({ name: '', startDate: '', endDate: '' });
      await loadCore();
      setSelectedPeriodId(created.id);
      setWeekAnchorDate(created.startDate.slice(0, 10));
    } finally {
      setBusy(false);
    }
  }

  async function setPeriodStatus(period: StaffRotaPeriod, status: 'draft' | 'published') {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/staff/rota/periods/${period.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        if (guardWrite(res)) toast.error(res.data.error || 'Failed to update period');
        return;
      }
      toast.success(status === 'published' ? 'Rota published' : 'Rota reverted to draft');
      setPeriods((prev) => prev.map((p) => (p.id === period.id ? { ...p, status } : p)));
    } finally {
      setBusy(false);
    }
  }

  async function deletePeriod(period: StaffRotaPeriod) {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/staff/rota/periods/${period.id}`, { method: 'DELETE' });
      if (!res.ok) {
        if (guardWrite(res)) toast.error(res.data.error || 'Failed to delete period');
        return;
      }
      toast.success('Rota period deleted');
      setPeriods((prev) => prev.filter((p) => p.id !== period.id));
      if (selectedPeriodId === period.id) setSelectedPeriodId('');
    } finally {
      setBusy(false);
    }
  }

  // ---- assignments ----------------------------------------------------------
  const createAssignment = useCallback(
    async (payload: {
      userId: string;
      workDate: string;
      shiftTemplateId?: string;
      startMinutes?: number;
      endMinutes?: number;
      breakMinutes?: number;
      notes?: string | null;
    }) => {
      if (!selectedPeriodId) return;
      const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const tpl = payload.shiftTemplateId ? templates.find((t) => t.id === payload.shiftTemplateId) : undefined;
      const startMin = payload.startMinutes ?? (tpl ? tpl.startMinutes : 8 * 60);
      const endMin = payload.endMinutes ?? (tpl ? tpl.endMinutes : 17 * 60);
      const subject = subjects.find((s) => s.id === payload.userId);
      const optimistic: StaffAssignment = {
        id: optimisticId,
        staffRotaPeriodId: selectedPeriodId,
        userId: payload.userId,
        staffShiftTemplateId: tpl?.id ?? null,
        workDate: payload.workDate,
        startsAt: isoForDayTime(payload.workDate, startMin),
        endsAt: isoForDayTime(payload.workDate, endMin <= startMin ? startMin + 60 : endMin),
        breakMinutes: payload.breakMinutes ?? tpl?.breakMinutes ?? 0,
        notes: payload.notes ?? null,
        user: subject ? { id: subject.id, name: subject.name, email: subject.email, department: subject.department, staffUserType: subject.staffUserType } : undefined,
        shiftTemplate: tpl ? { id: tpl.id, name: tpl.name, color: tpl.color } : null,
      };
      setAssignments((prev) => [...prev, optimistic]);

      const body: Record<string, unknown> = {
        rotaPeriodId: selectedPeriodId,
        userId: payload.userId,
        workDate: payload.workDate,
      };
      if (payload.shiftTemplateId) body.shiftTemplateId = payload.shiftTemplateId;
      else {
        body.startMinutes = startMin;
        body.endMinutes = endMin;
      }
      if (payload.breakMinutes != null) body.breakMinutes = payload.breakMinutes;
      if (payload.notes != null) body.notes = payload.notes;

      const res = await apiFetch<StaffAssignment>('/api/staff/rota/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setAssignments((prev) => prev.filter((a) => a.id !== optimisticId));
        if (res.status === 409 && res.data.conflicts?.length) {
          toast.error(`Blocked: ${res.data.conflicts[0]!.message}`);
        } else if (guardWrite(res)) {
          toast.error(res.data.error || 'Failed to create shift');
        }
        return;
      }
      const created = res.data as unknown as StaffAssignment;
      setAssignments((prev) => prev.map((a) => (a.id === optimisticId ? created : a)));
      void scanConflicts(selectedPeriodId, true);
    },
    [selectedPeriodId, templates, subjects, scanConflicts, guardWrite],
  );

  const updateAssignment = useCallback(
    async (id: string, body: Record<string, unknown>, optimistic?: Partial<StaffAssignment>) => {
      const prevSnapshot = assignments;
      if (optimistic) {
        setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, ...optimistic } : a)));
      }
      const res = await apiFetch<StaffAssignment>(`/api/staff/rota/assignments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setAssignments(prevSnapshot);
        if (res.status === 409 && res.data.conflicts?.length) {
          toast.error(`Blocked: ${res.data.conflicts[0]!.message}`);
        } else if (guardWrite(res)) {
          toast.error(res.data.error || 'Failed to update shift');
        }
        return false;
      }
      const updated = res.data as unknown as StaffAssignment;
      setAssignments((prev) => prev.map((a) => (a.id === id ? updated : a)));
      if (selectedPeriodId) void scanConflicts(selectedPeriodId, true);
      return true;
    },
    [assignments, selectedPeriodId, scanConflicts, guardWrite],
  );

  const deleteAssignment = useCallback(
    async (id: string) => {
      const prevSnapshot = assignments;
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      const res = await apiFetch(`/api/staff/rota/assignments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setAssignments(prevSnapshot);
        if (guardWrite(res)) toast.error(res.data.error || 'Failed to delete shift');
        return;
      }
      if (selectedPeriodId) void scanConflicts(selectedPeriodId, true);
    },
    [assignments, selectedPeriodId, scanConflicts, guardWrite],
  );

  const moveShift = useCallback(
    (assignment: StaffAssignment, target: { userId: string; workDate: string }) => {
      const startMin = localMinutes(assignment.startsAt);
      const endMin = localMinutes(assignment.endsAt);
      const body: Record<string, unknown> = { userId: target.userId, workDate: target.workDate };
      if (assignment.staffShiftTemplateId) body.shiftTemplateId = assignment.staffShiftTemplateId;
      else {
        body.startTime = fmtMinutes(startMin);
        body.endTime = fmtMinutes(endMin);
      }
      const subject = subjects.find((s) => s.id === target.userId);
      void updateAssignment(assignment.id, body, {
        userId: target.userId,
        workDate: target.workDate,
        startsAt: isoForDayTime(target.workDate, startMin),
        endsAt: isoForDayTime(target.workDate, endMin),
        user: subject
          ? { id: subject.id, name: subject.name, email: subject.email, department: subject.department, staffUserType: subject.staffUserType }
          : assignment.user,
      });
    },
    [subjects, updateAssignment],
  );

  const drawCreate = useCallback(
    (t: { userId: string; workDate: string; startMinutes: number; endMinutes: number }) => {
      void createAssignment({
        userId: t.userId,
        workDate: t.workDate,
        startMinutes: t.startMinutes,
        endMinutes: t.endMinutes,
        breakMinutes: 0,
      });
    },
    [createAssignment],
  );

  function openEdit(a: StaffAssignment) {
    setEditing(a);
    setEditDraft({
      workDate: toYmd(a.workDate),
      startHm: localHm(a.startsAt),
      endHm: localHm(a.endsAt),
      breakMinutes: a.breakMinutes,
      notes: a.notes ?? '',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      const ok = await updateAssignment(editing.id, {
        workDate: editDraft.workDate,
        startTime: editDraft.startHm,
        endTime: editDraft.endHm,
        breakMinutes: editDraft.breakMinutes,
        notes: editDraft.notes.trim() || null,
      });
      if (ok) {
        toast.success('Shift updated');
        setEditing(null);
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- batch ops ------------------------------------------------------------
  const runBatch = useCallback(
    async (items: Array<Record<string, unknown>>, title: string) => {
      if (!selectedPeriodId || !items.length) return;
      setBusy(true);
      try {
        const res = await apiFetch<{ created: number; skipped: Array<{ reason: string }> }>(
          '/api/staff/rota/assignments/batch',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rotaPeriodId: selectedPeriodId, items, skipConflicts: true }),
          },
        );
        if (!res.ok) {
          if (guardWrite(res)) toast.error(res.data.error || 'Batch failed');
          return;
        }
        const created = res.data.created ?? 0;
        const skipped = res.data.skipped?.length ?? 0;
        setLastResult({ title, created, skipped });
        toast.success(`${title}: ${created} created${skipped ? `, ${skipped} skipped` : ''}`);
        await loadAssignments(selectedPeriodId);
        void scanConflicts(selectedPeriodId, true);
      } finally {
        setBusy(false);
      }
    },
    [selectedPeriodId, loadAssignments, scanConflicts, guardWrite],
  );

  function bulkAssignTemplate() {
    if (!bulkTemplateId) {
      toast.error('Pick a template to apply');
      return;
    }
    if (!selectedIds.length) {
      toast.error('Select staff (checkboxes) first');
      return;
    }
    const items = selectedIds.flatMap((userId) =>
      weekDays.map((workDate) => ({ userId, workDate, shiftTemplateId: bulkTemplateId })),
    );
    void runBatch(items, 'Bulk weekly assignment');
  }

  function copyPreviousWeek() {
    const prevStart = addDays(weekDays[0]!, -7);
    const items: Array<Record<string, unknown>> = [];
    for (const subject of subjects) {
      for (let i = 0; i < 7; i++) {
        const prevDate = addDays(prevStart, i);
        const nextDate = weekDays[i]!;
        for (const s of assignmentsByKey.get(`${subject.id}|${prevDate}`) ?? []) {
          if (s.staffShiftTemplateId) {
            items.push({ userId: subject.id, workDate: nextDate, shiftTemplateId: s.staffShiftTemplateId, breakMinutes: s.breakMinutes, notes: s.notes });
          } else {
            items.push({
              userId: subject.id,
              workDate: nextDate,
              startTime: localHm(s.startsAt),
              endTime: localHm(s.endsAt),
              breakMinutes: s.breakMinutes,
              notes: s.notes,
            });
          }
        }
      }
    }
    if (!items.length) {
      toast.info('No shifts found in the previous week to copy');
      return;
    }
    void runBatch(items, 'Copy previous week');
  }

  async function seedWeek() {
    if (!selectedPeriodId || !subjects.length) return;
    setBusy(true);
    try {
      const defs = [
        { name: 'Day shift', startMinutes: 8 * 60, endMinutes: 16 * 60, breakMinutes: 45, color: '#2563eb' },
        { name: 'Evening shift', startMinutes: 14 * 60, endMinutes: 22 * 60, breakMinutes: 45, color: '#ea580c' },
      ];
      const resolved: Record<string, string> = {};
      let current = templates;
      for (const def of defs) {
        const existing = current.find((t) => t.name.toLowerCase() === def.name.toLowerCase());
        if (existing) {
          resolved[def.name] = existing.id;
          continue;
        }
        const res = await apiFetch<StaffShiftTemplate>('/api/staff/rota/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(def),
        });
        if (!res.ok) {
          if (guardWrite(res)) toast.error(res.data.error || 'Failed to seed templates');
          return;
        }
        const created = res.data as unknown as StaffShiftTemplate;
        resolved[def.name] = created.id;
        current = [...current, created];
      }
      setTemplates(current);
      const order = [defs[0]!.name, defs[1]!.name];
      const items: Array<Record<string, unknown>> = [];
      subjects.forEach((subject, idx) => {
        weekDays.forEach((workDate, dayIdx) => {
          if (dayIdx >= 5) return; // Mon–Fri
          const templateName = order[(idx + dayIdx) % order.length]!;
          items.push({ userId: subject.id, workDate, shiftTemplateId: resolved[templateName] });
        });
      });
      await runBatch(items, 'Seed week');
    } finally {
      setBusy(false);
    }
  }

  // ---- import ---------------------------------------------------------------
  async function previewImport() {
    if (!csvFile) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', csvFile);
      const res = await apiFetch<{ parseErrors?: Array<{ row: number; message: string }>; rows?: ImportPreviewRow[] }>(
        '/api/staff/rota/import/preview',
        { method: 'POST', body: fd },
      );
      if (!res.ok) {
        if (guardWrite(res)) toast.error(res.data.error || 'Preview failed');
        return;
      }
      setImportPreview(res.data as unknown as { parseErrors?: Array<{ row: number; message: string }>; rows?: ImportPreviewRow[] });
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!csvFile || !selectedPeriodId) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', csvFile);
      fd.append('rotaPeriodId', selectedPeriodId);
      const res = await apiFetch<{ created: number; skipped: Array<{ row: number; reason: string }> }>(
        '/api/staff/rota/import/commit',
        { method: 'POST', body: fd },
      );
      if (!res.ok) {
        if (guardWrite(res)) toast.error(res.data.error || 'Import failed');
        return;
      }
      const created = res.data.created ?? 0;
      const skipped = res.data.skipped?.length ?? 0;
      toast.success(`Imported ${created} shift${created === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped` : ''}`);
      setLastResult({ title: 'CSV import', created, skipped });
      setImportPreview(null);
      setCsvFile(null);
      await loadAssignments(selectedPeriodId);
      void scanConflicts(selectedPeriodId, true);
    } finally {
      setBusy(false);
    }
  }

  function toggleSelect(userId: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, userId])] : prev.filter((x) => x !== userId)));
  }

  // ---- keyboard shortcuts ---------------------------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (key === 'r') {
        e.preventDefault();
        void refreshAll();
      } else if (key === 'c' && selectedPeriodId) {
        e.preventDefault();
        void scanConflicts(selectedPeriodId);
      } else if (e.key === '[') {
        e.preventDefault();
        setWeekAnchorDate((d) => addDays(d || weekDays[0]!, -7));
      } else if (e.key === ']') {
        e.preventDefault();
        setWeekAnchorDate((d) => addDays(d || weekDays[0]!, 7));
      } else if (key === 'v') {
        e.preventDefault();
        setView((v) => (v === 'timeline' ? 'table' : 'timeline'));
      } else if (key === 's') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [refreshAll, scanConflicts, selectedPeriodId, weekDays]);

  const errorCount = conflicts.filter((c) => c.severity === 'error').length;
  const warnCount = conflicts.filter((c) => c.severity === 'warning').length;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Rota & scheduling"
        icon={CalendarRange}
        description="Plan shifts for your internal staff — build templates, roster the week, and publish."
        badges={[
          { label: `${subjects.length} staff`, icon: Users },
          { label: `${activeTemplates.length} templates`, icon: LayoutGrid },
          selectedPeriod
            ? {
                label: (
                  <span className={dashStatusChip(selectedPeriod.status === 'published' ? 'success' : 'neutral')}>
                    {selectedPeriod.status}
                  </span>
                ),
                bare: true,
              }
            : { label: 'No period', bare: false },
        ]}
        actions={
          <button type="button" onClick={() => void refreshAll()} className="btn-secondary inline-flex h-10 items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${busy || loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {readOnly ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Lock className="h-4 w-4" /> You have read-only access. Ask an admin or business manager to make changes.
        </div>
      ) : null}

      {lastResult ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="font-semibold">{lastResult.title}</span>
          <span className="ml-2">
            {lastResult.created != null ? `Created ${lastResult.created}` : ''}
            {lastResult.skipped ? ` · Skipped ${lastResult.skipped}` : ''}
          </span>
        </div>
      ) : null}

      {/* Templates + periods */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Templates */}
        <section className="dashboard-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 font-semibold text-[var(--dash-text-strong)]">
            <LayoutGrid className="h-5 w-5 text-primary-600" /> Shift templates
          </div>
          <div className="space-y-2">
            <input
              value={templateDraft.name}
              onChange={(e) => setTemplateDraft((s) => ({ ...s, name: e.target.value }))}
              placeholder="Template name (e.g. Morning)"
              className="h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <label className="text-[11px] text-neutral-500">
                Start
                <input
                  type="time"
                  value={templateDraft.startHm}
                  onChange={(e) => setTemplateDraft((s) => ({ ...s, startHm: e.target.value }))}
                  className="mt-0.5 h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm"
                />
              </label>
              <label className="text-[11px] text-neutral-500">
                End
                <input
                  type="time"
                  value={templateDraft.endHm}
                  onChange={(e) => setTemplateDraft((s) => ({ ...s, endHm: e.target.value }))}
                  className="mt-0.5 h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm"
                />
              </label>
              <label className="text-[11px] text-neutral-500">
                Break (min)
                <input
                  type="number"
                  min={0}
                  value={templateDraft.breakMinutes}
                  onChange={(e) => setTemplateDraft((s) => ({ ...s, breakMinutes: Math.max(0, parseInt(e.target.value || '0', 10)) }))}
                  className="mt-0.5 h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm"
                />
              </label>
            </div>
            <div className="flex items-center gap-1.5">
              {TEMPLATE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => setTemplateDraft((s) => ({ ...s, color: c }))}
                  className={`h-6 w-6 rounded-full border-2 ${templateDraft.color === c ? 'border-neutral-800' : 'border-white'} shadow`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveTemplate()}
                disabled={busy || readOnly}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary-700 px-3 text-sm text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> {editingTemplateId ? 'Update template' : 'Add template'}
              </button>
              {editingTemplateId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTemplateId(null);
                    setTemplateDraft(DEFAULT_TEMPLATE_DRAFT);
                  }}
                  className="h-9 rounded-lg border border-neutral-300 px-3 text-sm"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-3 max-h-48 space-y-1 overflow-auto">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${t.isActive ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-200 bg-neutral-100 opacity-60'}`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.color || '#94a3b8' }} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-neutral-800">{t.name}</span>{' '}
                  <span className="text-neutral-500">
                    {fmtMinutes(t.startMinutes)}–{fmtMinutes(t.endMinutes)} · {t.breakMinutes}m break
                  </span>
                </span>
                <button type="button" onClick={() => startEditTemplate(t)} disabled={readOnly} className="rounded p-1 text-neutral-500 hover:bg-neutral-200 disabled:opacity-40">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => void deleteTemplate(t.id)} disabled={readOnly} className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-40">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {!templates.length ? <p className="text-xs text-neutral-500">No templates yet.</p> : null}
          </div>
        </section>

        {/* Periods */}
        <section className="dashboard-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 font-semibold text-[var(--dash-text-strong)]">
            <CalendarRange className="h-5 w-5 text-primary-600" /> Rota periods
          </div>
          <div className="space-y-2">
            <input
              value={periodDraft.name}
              onChange={(e) => setPeriodDraft((s) => ({ ...s, name: e.target.value }))}
              placeholder="Period name (optional)"
              className="h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={periodDraft.startDate}
                onChange={(e) => setPeriodDraft((s) => ({ ...s, startDate: e.target.value }))}
                className="h-9 rounded-lg border border-neutral-300 px-2 text-sm"
              />
              <input
                type="date"
                value={periodDraft.endDate}
                onChange={(e) => setPeriodDraft((s) => ({ ...s, endDate: e.target.value }))}
                className="h-9 rounded-lg border border-neutral-300 px-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void createPeriod()}
              disabled={busy || readOnly}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary-700 px-3 text-sm text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add period
            </button>
          </div>
          <div className="mt-3 max-h-48 space-y-1 overflow-auto">
            {periods.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-xs ${
                  selectedPeriodId === p.id ? 'border-primary-400 bg-primary-50' : 'border-neutral-200 bg-neutral-50'
                }`}
              >
                <button type="button" onClick={() => setSelectedPeriodId(p.id)} className="min-w-0 flex-1 text-left">
                  <div className="truncate font-medium text-neutral-800">{p.name || 'Unnamed period'}</div>
                  <div className="text-neutral-500">
                    {toYmd(p.startDate)} → {toYmd(p.endDate)}
                  </div>
                </button>
                <span className={dashStatusChip(p.status === 'published' ? 'success' : 'neutral')}>{p.status}</span>
                <button
                  type="button"
                  onClick={() => void setPeriodStatus(p, p.status === 'published' ? 'draft' : 'published')}
                  disabled={readOnly}
                  className="rounded border border-neutral-300 bg-white px-2 py-1 text-[11px] disabled:opacity-40"
                >
                  {p.status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  type="button"
                  onClick={() => void deletePeriod(p)}
                  disabled={readOnly || p.status === 'published'}
                  className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {!periods.length ? <p className="text-xs text-neutral-500">No periods yet.</p> : null}
          </div>
        </section>
      </div>

      {/* Planner */}
      <section className="dashboard-surface p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-[var(--dash-text-strong)]">
            <Clock className="h-5 w-5 text-primary-600" /> Weekly planner
          </div>
          <div className="inline-flex items-center rounded-lg border border-neutral-300 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView('timeline')}
              className={`inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] ${view === 'timeline' ? 'bg-primary-700 text-white' : 'text-neutral-700'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Timeline
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              className={`inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] ${view === 'table' ? 'bg-primary-700 text-white' : 'text-neutral-700'}`}
            >
              <Rows3 className="h-3.5 w-3.5" /> Grid
            </button>
          </div>
        </div>

        {!selectedPeriodId ? (
          <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
            Create or select a rota period above to start planning.
          </p>
        ) : (
          <>
            {isPublished ? (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Lock className="h-4 w-4" /> This period is published. Unpublish it to edit shifts or import.
              </div>
            ) : null}

            {/* Toolbar */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setWeekAnchorDate((d) => addDays(d || weekDays[0]!, -7))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[150px] text-center text-xs font-medium text-neutral-600">
                  {shortDate(weekDays[0]!)} – {shortDate(weekDays[6]!)}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekAnchorDate((d) => addDays(d || weekDays[0]!, 7))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-300 bg-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff (s)"
                className="h-8 min-w-[180px] rounded-lg border border-neutral-300 px-2 text-xs"
              />
              <label className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                Min/day
                <input
                  type="number"
                  min={0}
                  value={coverageTarget}
                  onChange={(e) => setCoverageTarget(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="h-8 w-14 rounded-lg border border-neutral-300 px-2 text-xs"
                />
              </label>
              <button
                type="button"
                onClick={() => void scanConflicts(selectedPeriodId)}
                disabled={busy}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 text-xs disabled:opacity-50"
              >
                <ScanSearch className="h-3.5 w-3.5" /> Scan
              </button>
              {errorCount + warnCount > 0 ? (
                <span className="inline-flex items-center gap-2 text-[11px]">
                  {errorCount > 0 ? <span className={dashStatusChip('danger')}>{errorCount} blocking</span> : null}
                  {warnCount > 0 ? <span className={dashStatusChip('warning')}>{warnCount} advisory</span> : null}
                </span>
              ) : null}
            </div>

            {/* Bulk actions */}
            {!locked ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                <span className="text-[11px] font-medium text-neutral-500">{selectedIds.length} selected</span>
                <StrideSelect
                  value={bulkTemplateId}
                  onChange={setBulkTemplateId}
                  options={[{ value: '', label: 'Template for week…' }, ...activeTemplates.map((t) => ({ value: t.id, label: t.name }))]}
                  ariaLabel="Bulk template"
                  size="sm"
                  className="min-w-[170px]"
                />
                <button
                  type="button"
                  onClick={bulkAssignTemplate}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 text-xs disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Apply to selected
                </button>
                <button
                  type="button"
                  onClick={copyPreviousWeek}
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 text-xs disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy previous week
                </button>
                <button
                  type="button"
                  onClick={() => void seedWeek()}
                  disabled={busy || !subjects.length}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 text-xs disabled:opacity-50"
                >
                  <Zap className="h-3.5 w-3.5" /> Seed week
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <StrideSelect
                    value={brushTemplateId}
                    onChange={setBrushTemplateId}
                    options={[{ value: '', label: 'Click-to-add template…' }, ...activeTemplates.map((t) => ({ value: t.id, label: t.name }))]}
                    ariaLabel="Brush template"
                    size="sm"
                    className="min-w-[170px]"
                  />
                </div>
              </div>
            ) : null}

            {view === 'timeline' ? (
              <StaffRotaTimeline
                subjects={filteredSubjects}
                assignmentsBySubject={assignmentsBySubject}
                weekDays={weekDays}
                dayTotals={dayTotals}
                holidays={holidays}
                coverageTarget={coverageTarget}
                conflictAssignmentIds={conflictAssignmentIds}
                templateColorById={templateColorById}
                selectedIds={selectedIds}
                readOnly={locked}
                onToggleSelect={toggleSelect}
                onEditShift={openEdit}
                onMoveShift={moveShift}
                onDrawCreate={drawCreate}
              />
            ) : (
              <TableGrid
                subjects={filteredSubjects}
                weekDays={weekDays}
                dayTotals={dayTotals}
                holidays={holidays}
                coverageTarget={coverageTarget}
                assignmentsByKey={assignmentsByKey}
                conflictAssignmentIds={conflictAssignmentIds}
                templateColorById={templateColorById}
                selectedIds={selectedIds}
                brushTemplateId={brushTemplateId}
                locked={locked}
                onToggleSelect={toggleSelect}
                onEditShift={openEdit}
                onDeleteShift={(id) => void deleteAssignment(id)}
                onCellAdd={(userId, workDate) => {
                  if (!brushTemplateId) {
                    toast.info('Pick a "Click-to-add template" first');
                    return;
                  }
                  void createAssignment({ userId, workDate, shiftTemplateId: brushTemplateId });
                }}
              />
            )}
          </>
        )}
      </section>

      {/* Conflicts + coverage */}
      {selectedPeriodId ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="dashboard-surface p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold text-amber-700">
              <AlertTriangle className="h-5 w-5" /> Conflicts
            </div>
            <div className="max-h-56 space-y-1 overflow-auto text-xs">
              {conflicts.filter((c) => c.userId).length === 0 ? (
                <p className="text-neutral-500">No per-person conflicts.</p>
              ) : (
                [...conflictsByUser.entries()].map(([userId, items]) => {
                  const subject = subjects.find((s) => s.id === userId);
                  return (
                    <div key={userId} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                      <div className="font-medium text-amber-900">{subject?.name ?? userId}</div>
                      {items.slice(0, 4).map((c, i) => (
                        <div key={i} className="flex items-center gap-1 text-amber-800">
                          <span className={dashStatusChip(c.severity === 'error' ? 'danger' : 'warning')}>{c.severity}</span>
                          <span>{c.message}</span>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="dashboard-surface p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--dash-text-strong)]">
              <Users className="h-5 w-5 text-primary-600" /> Coverage heatmap
            </div>
            <p className="mb-2 text-[11px] text-neutral-500">
              Distinct staff scheduled per day{coverageTarget > 0 ? ` (target ${coverageTarget})` : ''}. Set “Min/day” to flag gaps.
            </p>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((d) => {
                const total = dayTotals[d] ?? { staff: 0, hours: 0, shifts: 0 };
                const understaffed = coverageTarget > 0 && total.staff < coverageTarget;
                const tone = understaffed ? 'bg-red-100 text-red-800 border-red-300' : total.staff > 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-neutral-100 text-neutral-500 border-neutral-200';
                return (
                  <div key={d} className={`rounded-lg border px-1.5 py-2 text-center ${tone}`}>
                    <div className="text-[10px] font-medium">{shortDate(d).split(' ')[0]}</div>
                    <div className="text-base font-semibold tabular-nums">{total.staff}</div>
                    <div className="text-[10px]">{total.hours.toFixed(0)}h</div>
                  </div>
                );
              })}
            </div>
            {coverageConflicts.length ? (
              <div className="mt-2 text-[11px] text-red-600">
                {coverageConflicts.length} day{coverageConflicts.length === 1 ? '' : 's'} below target.
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {/* CSV import */}
      {selectedPeriodId && !readOnly ? (
        <section className="dashboard-surface p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 font-semibold text-[var(--dash-text-strong)]">
            <FileSpreadsheet className="h-5 w-5 text-primary-600" /> CSV import
          </div>
          <p className="mb-2 text-[11px] text-neutral-500">
            Columns: <code>staff</code> (email or full name), <code>work_date</code> (YYYY-MM-DD),{' '}
            <code>shift_template</code> or <code>start_time</code>+<code>end_time</code>, optional <code>break_minutes</code>, <code>notes</code>.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} className="text-xs" />
            <button
              type="button"
              onClick={() => void previewImport()}
              disabled={!csvFile || busy || isPublished}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-300 px-3 text-sm disabled:opacity-50"
            >
              <Upload className="h-4 w-4" /> Preview
            </button>
            <button
              type="button"
              onClick={() => void commitImport()}
              disabled={!csvFile || busy || isPublished}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary-700 px-3 text-sm text-white disabled:opacity-50"
            >
              Commit to period
            </button>
          </div>
          {importPreview ? (
            <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-xs">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Rows: {importPreview.rows?.length ?? 0}</span>
                <span>Parse errors: {importPreview.parseErrors?.length ?? 0}</span>
                <span>Row errors: {(importPreview.rows ?? []).filter((r) => r.error).length}</span>
                <span>Matched: {(importPreview.rows ?? []).filter((r) => r.userId && !r.error).length}</span>
              </div>
              {(importPreview.rows ?? []).filter((r) => r.error).length ? (
                <div className="mt-2 max-h-28 space-y-0.5 overflow-auto">
                  {(importPreview.rows ?? [])
                    .filter((r) => r.error)
                    .slice(0, 10)
                    .map((r) => (
                      <div key={r.row} className="text-red-700">
                        Row {r.row} ({r.staff}): {r.error}
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Edit modal */}
      {editing ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-xl bg-[var(--dash-surface-solid)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">Edit shift</h3>
              <span className="text-xs text-neutral-500">{editing.user?.name}</span>
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] text-neutral-500">
                Work date
                <input
                  type="date"
                  value={editDraft.workDate}
                  onChange={(e) => setEditDraft((s) => ({ ...s, workDate: e.target.value }))}
                  className="mt-0.5 h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-[11px] text-neutral-500">
                  Start
                  <input type="time" value={editDraft.startHm} onChange={(e) => setEditDraft((s) => ({ ...s, startHm: e.target.value }))} className="mt-0.5 h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm" />
                </label>
                <label className="text-[11px] text-neutral-500">
                  End
                  <input type="time" value={editDraft.endHm} onChange={(e) => setEditDraft((s) => ({ ...s, endHm: e.target.value }))} className="mt-0.5 h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm" />
                </label>
                <label className="text-[11px] text-neutral-500">
                  Break
                  <input type="number" min={0} value={editDraft.breakMinutes} onChange={(e) => setEditDraft((s) => ({ ...s, breakMinutes: Math.max(0, parseInt(e.target.value || '0', 10)) }))} className="mt-0.5 h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm" />
                </label>
              </div>
              <label className="block text-[11px] text-neutral-500">
                Notes
                <input value={editDraft.notes} onChange={(e) => setEditDraft((s) => ({ ...s, notes: e.target.value }))} className="mt-0.5 h-9 w-full rounded-lg border border-neutral-300 px-2 text-sm" />
              </label>
            </div>
            <div className="mt-4 flex justify-between">
              <button
                type="button"
                onClick={() => {
                  const id = editing.id;
                  setEditing(null);
                  void deleteAssignment(id);
                }}
                disabled={locked}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-300 px-3 text-sm text-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="h-9 rounded-lg border border-neutral-300 px-3 text-sm">
                  Cancel
                </button>
                <button type="button" onClick={() => void saveEdit()} disabled={busy || locked} className="h-9 rounded-lg bg-primary-700 px-3 text-sm text-white disabled:opacity-50">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-neutral-400">
        Shortcuts: <b>r</b> refresh · <b>c</b> scan conflicts · <b>v</b> toggle view · <b>[</b> / <b>]</b> change week · <b>s</b> search.
        Policies enforce per-role rest, weekly caps, overlaps and shift length; blocking conflicts return 409.
      </p>
    </DashboardPage>
  );
}

// ---------------------------------------------------------------------------
// Grid (table) view
// ---------------------------------------------------------------------------
function TableGrid({
  subjects,
  weekDays,
  dayTotals,
  holidays,
  coverageTarget,
  assignmentsByKey,
  conflictAssignmentIds,
  templateColorById,
  selectedIds,
  brushTemplateId,
  locked,
  onToggleSelect,
  onEditShift,
  onDeleteShift,
  onCellAdd,
}: {
  subjects: StaffSubject[];
  weekDays: string[];
  dayTotals: Record<string, { shifts: number; hours: number; staff: number }>;
  holidays: Map<string, string>;
  coverageTarget: number;
  assignmentsByKey: Map<string, StaffAssignment[]>;
  conflictAssignmentIds: Set<string>;
  templateColorById: Map<string, string>;
  selectedIds: string[];
  brushTemplateId: string;
  locked: boolean;
  onToggleSelect: (userId: string, checked: boolean) => void;
  onEditShift: (a: StaffAssignment) => void;
  onDeleteShift: (id: string) => void;
  onCellAdd: (userId: string, workDate: string) => void;
}) {
  const selected = new Set(selectedIds);
  return (
    <div className="overflow-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full min-w-[900px] text-xs">
        <thead className="bg-neutral-50 text-neutral-600">
          <tr>
            <th className="w-52 px-2 py-2 text-left">Staff</th>
            {weekDays.map((d) => {
              const total = dayTotals[d] ?? { staff: 0, hours: 0, shifts: 0 };
              const understaffed = coverageTarget > 0 && total.staff < coverageTarget;
              return (
                <th key={d} className={`px-2 py-2 text-center ${understaffed ? 'bg-red-50' : ''}`}>
                  <div>{shortDate(d)}</div>
                  {holidays.get(d) ? <div className="text-[10px] font-medium text-amber-700">{holidays.get(d)}</div> : null}
                  <div className={`text-[10px] ${understaffed ? 'font-semibold text-red-600' : 'text-neutral-500'}`}>
                    {total.staff} staff · {total.hours.toFixed(1)}h
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => (
            <tr key={s.id} className="border-t border-neutral-200 align-top">
              <td className="px-2 py-2">
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={(e) => onToggleSelect(s.id, e.target.checked)} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-neutral-800">{s.name}</span>
                    <span className="block truncate text-[10px] text-neutral-400">{s.department || 'Unassigned'}</span>
                  </span>
                </label>
              </td>
              {weekDays.map((d) => {
                const cell = assignmentsByKey.get(`${s.id}|${d}`) ?? [];
                return (
                  <td key={`${s.id}-${d}`} className="border-l border-neutral-100 px-1.5 py-1.5">
                    <div className="space-y-1">
                      {cell.map((a) => {
                        const conflict = conflictAssignmentIds.has(a.id);
                        return (
                          <div
                            key={a.id}
                            className={`group flex items-center gap-1 rounded-md border px-1.5 py-1 ${conflict ? 'border-amber-400 bg-amber-50' : 'border-black/10'}`}
                            style={{ backgroundColor: conflict ? undefined : a.staffShiftTemplateId ? templateColorById.get(a.staffShiftTemplateId) ?? '#eef2ff' : '#f3f4f6' }}
                          >
                            <button type="button" onClick={() => onEditShift(a)} className="min-w-0 flex-1 text-left text-[11px] tabular-nums text-neutral-900">
                              {formatShiftRangeCompact(a.startsAt, a.endsAt)}
                            </button>
                            {!locked ? (
                              <button type="button" onClick={() => onDeleteShift(a.id)} className="opacity-0 group-hover:opacity-100">
                                <Trash2 className="h-3 w-3 text-red-600" />
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                      {!locked ? (
                        <button
                          type="button"
                          onClick={() => onCellAdd(s.id, d)}
                          className="flex w-full items-center justify-center rounded-md border border-dashed border-neutral-300 py-0.5 text-[10px] text-neutral-400 hover:border-primary-300 hover:text-primary-600"
                          title={brushTemplateId ? 'Add shift from selected template' : 'Pick a click-to-add template first'}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          {!subjects.length ? (
            <tr>
              <td colSpan={weekDays.length + 1} className="px-2 py-6 text-center text-neutral-500">
                No staff match your filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
