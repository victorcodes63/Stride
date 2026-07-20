'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarPlus, Plus, Trash2 } from 'lucide-react';
import {
  DashboardTable,
  DashboardTableActionButton,
  DashboardTableActions,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmpty,
  DashboardTableHead,
  DashboardTableMeta,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import {
  DashboardAsyncState,
  type DashboardAsyncStatus,
} from '@/components/dashboard/DashboardAsyncState';
import { StrideSelect } from '@/components/ui/stride-select';

type Period = {
  id: string;
  name: string | null;
  startDate: string;
  endDate: string;
  status: string;
};

type Template = {
  id: string;
  name: string;
  startMinutes: number;
  endMinutes: number;
  color: string | null;
};

type Assignment = {
  id: string;
  employeeId: string;
  workDate: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
  } | null;
  shiftTemplate: { id: string; name: string; color: string | null } | null;
};

type EmployeeRow = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string | null;
};

type RotaConflict = { type: string; message: string };

const CUSTOM_SHIFT = '__custom__';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoToYmd(iso: string) {
  return iso.slice(0, 10);
}

function minutesToHm(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${pad(h)}:${pad(m)}`;
}

function isoToHm(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function periodLabel(p: Period) {
  const range = `${isoToYmd(p.startDate)} → ${isoToYmd(p.endDate)}`;
  return p.name ? `${p.name} (${range})` : range;
}

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

export function OutsourcingRotaPlanner({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<DashboardAsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Create-period form
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [periodName, setPeriodName] = useState('');
  const [periodStart, setPeriodStart] = useState(() => ymd(new Date()));
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return ymd(d);
  });

  // Assignment form
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formShiftId, setFormShiftId] = useState('');
  const [formWorkDate, setFormWorkDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('17:00');

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  );

  const loadCore = useCallback(async () => {
    if (!clientId) return;
    setStatus('loading');
    setError(null);
    try {
      const [pRes, tRes, eRes] = await Promise.all([
        fetch(`/api/rota/periods?outsourcingClientId=${encodeURIComponent(clientId)}`),
        fetch(`/api/rota/templates?outsourcingClientId=${encodeURIComponent(clientId)}`),
        fetch(
          `/api/outsourcing/employees?clientId=${encodeURIComponent(clientId)}&status=active`,
        ),
      ]);
      const pJson = (await readJson(pRes)) as Period[] | { error?: string } | null;
      const tJson = (await readJson(tRes)) as Template[] | { error?: string } | null;
      const eJson = (await readJson(eRes)) as EmployeeRow[] | { error?: string } | null;

      if (!pRes.ok) {
        throw new Error(
          (pJson && !Array.isArray(pJson) && pJson.error) || 'Failed to load rota periods.',
        );
      }

      const periodList = Array.isArray(pJson) ? pJson : [];
      setPeriods(periodList);
      setTemplates(Array.isArray(tJson) ? tJson : []);
      setEmployees(Array.isArray(eJson) ? eJson : []);

      setSelectedPeriodId((current) => {
        if (current && periodList.some((p) => p.id === current)) return current;
        return periodList[0]?.id ?? '';
      });
      setStatus('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rota.');
      setStatus('error');
    }
  }, [clientId]);

  const loadAssignments = useCallback(async () => {
    if (!selectedPeriodId) {
      setAssignments([]);
      return;
    }
    const res = await fetch(
      `/api/rota/assignments?rotaPeriodId=${encodeURIComponent(selectedPeriodId)}`,
    );
    const json = (await readJson(res)) as Assignment[] | null;
    setAssignments(res.ok && Array.isArray(json) ? json : []);
  }, [selectedPeriodId]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  // Keep the assignment work-date within the selected period.
  useEffect(() => {
    if (!selectedPeriod) return;
    const start = isoToYmd(selectedPeriod.startDate);
    const end = isoToYmd(selectedPeriod.endDate);
    setFormWorkDate((current) => (current >= start && current <= end ? current : start));
  }, [selectedPeriod]);

  async function createPeriod() {
    if (!clientId) return;
    if (!periodStart || !periodEnd) {
      setError('Provide a start and end date for the rota period.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/rota/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outsourcingClientId: clientId,
          name: periodName.trim() || null,
          startDate: periodStart,
          endDate: periodEnd,
        }),
      });
      const json = (await readJson(res)) as (Period & { error?: string }) | null;
      if (!res.ok || !json) {
        throw new Error((json && json.error) || 'Failed to create rota period.');
      }
      setShowPeriodForm(false);
      setPeriodName('');
      await loadCore();
      setSelectedPeriodId(json.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create rota period.');
    } finally {
      setBusy(false);
    }
  }

  async function createAssignment() {
    if (!selectedPeriodId) {
      setError('Select or create a rota period first.');
      return;
    }
    if (!formEmployeeId) {
      setError('Select an employee.');
      return;
    }
    if (!formWorkDate) {
      setError('Select a work date.');
      return;
    }
    const useCustom = !formShiftId || formShiftId === CUSTOM_SHIFT;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const body: Record<string, unknown> = {
        rotaPeriodId: selectedPeriodId,
        employeeId: formEmployeeId,
        workDate: formWorkDate,
      };
      if (useCustom) {
        body.startTime = formStartTime;
        body.endTime = formEndTime;
      } else {
        body.shiftTemplateId = formShiftId;
      }

      const res = await fetch('/api/rota/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await readJson(res)) as
        | { error?: string; conflicts?: RotaConflict[] }
        | null;

      if (res.status === 409) {
        const messages = (json?.conflicts ?? []).map((c) => c.message).filter(Boolean);
        setNotice(
          messages.length
            ? `Scheduling conflict: ${messages.join(' ')}`
            : json?.error || 'Scheduling conflict detected.',
        );
        return;
      }
      if (!res.ok) {
        throw new Error(json?.error || 'Could not create assignment.');
      }
      await loadAssignments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create assignment.');
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(id: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/rota/assignments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = (await readJson(res)) as { error?: string } | null;
        throw new Error(json?.error || 'Could not remove assignment.');
      }
      await loadAssignments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove assignment.');
    } finally {
      setBusy(false);
    }
  }

  const periodOptions = useMemo(
    () => periods.map((p) => ({ value: p.id, label: periodLabel(p) })),
    [periods],
  );

  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'Select employee…' },
      ...employees.map((e) => ({
        value: e.id,
        label: e.employeeNumber
          ? `${e.employeeNumber} — ${e.firstName} ${e.lastName}`
          : `${e.firstName} ${e.lastName}`,
      })),
    ],
    [employees],
  );

  const shiftOptions = useMemo(
    () => [
      ...templates.map((t) => ({
        value: t.id,
        label: `${t.name} · ${minutesToHm(t.startMinutes)}–${minutesToHm(t.endMinutes)}`,
      })),
      { value: CUSTOM_SHIFT, label: 'Custom start/end time…' },
    ],
    [templates],
  );

  const usingCustom = !formShiftId || formShiftId === CUSTOM_SHIFT;

  return (
    <DashboardAsyncState
      status={status}
      error={error}
      onRetry={() => void loadCore()}
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{notice}</span>
          </div>
        ) : null}

        {/* Period selector + create */}
        <div className="dashboard-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-md">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Rota period
              </span>
              {periods.length ? (
                <StrideSelect
                  value={selectedPeriodId}
                  onChange={setSelectedPeriodId}
                  options={periodOptions}
                  ariaLabel="Rota period"
                  placeholder="Select a rota period…"
                />
              ) : (
                <span className="text-sm text-neutral-500">
                  No rota periods yet for this client.
                </span>
              )}
            </label>
            <DashboardTableActionButton
              variant="secondary"
              onClick={() => setShowPeriodForm((v) => !v)}
            >
              <CalendarPlus className="mr-1.5 h-4 w-4" />
              {showPeriodForm ? 'Cancel' : 'New period'}
            </DashboardTableActionButton>
          </div>

          {showPeriodForm ? (
            <div className="mt-4 grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                <span className="text-neutral-500">Name (optional)</span>
                <input
                  value={periodName}
                  onChange={(e) => setPeriodName(e.target.value)}
                  placeholder="e.g. Week 32"
                  className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-neutral-500">Start date</span>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-neutral-500">End date</span>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <div className="sm:col-span-4">
                <DashboardTableActionButton
                  variant="primary"
                  onClick={() => void createPeriod()}
                  disabled={busy}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create rota period
                </DashboardTableActionButton>
              </div>
            </div>
          ) : null}
        </div>

        {/* Assignment form */}
        <div className="dashboard-surface p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Assign a shift
          </p>
          <div className="grid items-end gap-3 lg:grid-cols-5">
            <label className="flex flex-col gap-1 text-xs lg:col-span-2">
              <span className="text-neutral-500">Employee</span>
              <StrideSelect
                value={formEmployeeId}
                onChange={setFormEmployeeId}
                options={employeeOptions}
                ariaLabel="Employee"
                disabled={employees.length === 0}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-neutral-500">Work date</span>
              <input
                type="date"
                value={formWorkDate}
                min={selectedPeriod ? isoToYmd(selectedPeriod.startDate) : undefined}
                max={selectedPeriod ? isoToYmd(selectedPeriod.endDate) : undefined}
                onChange={(e) => setFormWorkDate(e.target.value)}
                className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-neutral-500">Shift</span>
              <StrideSelect
                value={formShiftId || CUSTOM_SHIFT}
                onChange={setFormShiftId}
                options={shiftOptions}
                ariaLabel="Shift template"
              />
            </label>
            <div>
              <DashboardTableActionButton
                variant="primary"
                onClick={() => void createAssignment()}
                disabled={busy || !selectedPeriodId}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Assign
              </DashboardTableActionButton>
            </div>
          </div>

          {usingCustom ? (
            <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-neutral-100 pt-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-neutral-500">Start time</span>
                <input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-neutral-500">End time</span>
                <input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  className="h-10 rounded-lg border border-neutral-300 px-3 text-sm"
                />
              </label>
            </div>
          ) : null}

          {employees.length === 0 ? (
            <p className="mt-3 text-xs text-neutral-500">
              No active employees found for this end-client.
            </p>
          ) : null}
        </div>

        {/* Assignments table */}
        <DashboardTableCard>
          <DashboardTableMeta
            title="Scheduled shifts"
            description={
              selectedPeriod
                ? `Assignments for ${periodLabel(selectedPeriod)}`
                : 'Select a rota period to view its assignments.'
            }
          />
          <DashboardTableViewport minWidth={720}>
            <DashboardTable>
              <thead>
                <tr>
                  <DashboardTableHead>Employee</DashboardTableHead>
                  <DashboardTableHead>Date</DashboardTableHead>
                  <DashboardTableHead>Shift</DashboardTableHead>
                  <DashboardTableHead>Time</DashboardTableHead>
                  <DashboardTableHead align="right">Actions</DashboardTableHead>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <DashboardTableEmpty
                    colSpan={5}
                    message={
                      selectedPeriodId
                        ? 'No shifts scheduled for this period yet.'
                        : 'No rota period selected.'
                    }
                  />
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id}>
                      <DashboardTableCell>
                        <div className="font-medium text-neutral-900">
                          {a.employee
                            ? `${a.employee.firstName} ${a.employee.lastName}`
                            : '—'}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {a.employee?.employeeNumber ?? '—'}
                        </div>
                      </DashboardTableCell>
                      <DashboardTableCell numeric>{isoToYmd(a.workDate)}</DashboardTableCell>
                      <DashboardTableCell>
                        {a.shiftTemplate?.name ?? 'Custom'}
                      </DashboardTableCell>
                      <DashboardTableCell numeric>
                        {isoToHm(a.startsAt)}–{isoToHm(a.endsAt)}
                      </DashboardTableCell>
                      <DashboardTableCell align="right">
                        <DashboardTableActions>
                          <DashboardTableActionButton
                            variant="secondary"
                            onClick={() => void removeAssignment(a.id)}
                            disabled={busy}
                            aria-label="Remove shift"
                          >
                            <Trash2 className="h-4 w-4" />
                          </DashboardTableActionButton>
                        </DashboardTableActions>
                      </DashboardTableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        </DashboardTableCard>
      </div>
    </DashboardAsyncState>
  );
}
