'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ClipboardList, PlayCircle } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam';
import { useListFilters } from '@/hooks/useListFilters';

type WorkflowRow = {
  id: string;
  type: 'ONBOARDING' | 'OFFBOARDING';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  employee: { firstName: string; lastName: string; department?: { name: string | null } | null };
  tasks: Array<{ status: string; dueDate?: string | null }>;
};

const WORKFLOW_TYPES = ['ONBOARDING', 'OFFBOARDING'] as const;
type WorkflowType = (typeof WORKFLOW_TYPES)[number];

const ONBOARDING_FILTER_DEFAULTS = { status: '', search: '' };

async function readWorkflowsResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not load workflows.');
  }
  return data;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading onboarding…</div>}>
      <OnboardingPageContent />
    </Suspense>
  );
}

function OnboardingPageContent() {
  const { tab: type, setTab: setType } = useDashboardTabParam('type', WORKFLOW_TYPES, 'ONBOARDING');
  const { filters, setFilter, clearFilters, hasActiveFilters } = useListFilters(
    ['status', 'search'],
    ONBOARDING_FILTER_DEFAULTS,
  );
  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [startForm, setStartForm] = useState({ employeeId: '', templateId: '' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('type', type);
    if (filters.status) params.set('status', filters.status);
    if (filters.search.trim()) params.set('search', filters.search.trim());

    fetch(`/api/onboarding/workflows?${params.toString()}`)
      .then((r) => readWorkflowsResponse(r))
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load workflows.');
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.search, filters.status, type]);

  useEffect(() => {
    if (!startOpen) return;
    void Promise.all([
      fetch('/api/outsourcing/employees').then((r) => r.json()),
      fetch(`/api/onboarding/templates?type=${type}`).then((r) => r.json()),
    ]).then(([empData, tplData]) => {
      if (Array.isArray(empData)) {
        setEmployees(
          empData.map((e: { id: string; firstName: string; lastName: string }) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`.trim(),
          })),
        );
      }
      if (Array.isArray(tplData)) setTemplates(tplData);
    });
  }, [startOpen, type]);

  async function startWorkflow() {
    if (!startForm.employeeId) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: startForm.employeeId,
          type,
          ...(startForm.templateId ? { templateId: startForm.templateId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start workflow');
      setStartOpen(false);
      window.location.href = `/dashboard/onboarding/${data.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start workflow');
    } finally {
      setStarting(false);
    }
  }

  const view = useMemo(
    () =>
      rows.map((row) => {
        const total = row.tasks.length;
        const complete = row.tasks.filter((task) => task.status === 'COMPLETED').length;
        const overdue = row.tasks.filter(
          (task) =>
            task.status === 'OVERDUE' ||
            (task.status === 'PENDING' && task.dueDate && new Date(task.dueDate) < new Date()),
        ).length;
        return { ...row, total, complete, overdue };
      }),
    [rows],
  );

  const status = useMemo(() => {
    if (loading) return 'loading' as const;
    if (error) return 'error' as const;
    if (view.length === 0) return 'empty' as const;
    return 'success' as const;
  }, [error, loading, view.length]);

  const reload = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('type', type);
    if (filters.status) params.set('status', filters.status);
    if (filters.search.trim()) params.set('search', filters.search.trim());
    fetch(`/api/onboarding/workflows?${params.toString()}`)
      .then((r) => readWorkflowsResponse(r))
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not load workflows.');
        setRows([]);
      })
      .finally(() => setLoading(false));
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Onboarding & Offboarding"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/onboarding/templates" className="btn-secondary inline-flex h-10 items-center px-3 text-sm">
              Templates
            </Link>
            <Link href="/dashboard/people/tasks" className="btn-secondary inline-flex h-10 items-center px-3 text-sm">
              My tasks
            </Link>
            <button type="button" onClick={() => setStartOpen(true)} className="btn-primary inline-flex h-10 items-center gap-2 px-3">
              <PlayCircle className="h-4 w-4" />
              Start workflow
            </button>
          </div>
        }
        footer={
          <DashboardTabs
            embedded
            value={type}
            onChange={(next) => setType(next as WorkflowType)}
            items={[
              { value: 'ONBOARDING', label: 'Onboarding' },
              { value: 'OFFBOARDING', label: 'Offboarding' },
            ]}
          />
        }
      />

      {startOpen ? (
        <div className="mb-6 dashboard-surface shadow-sm p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-semibold">Start {type === 'ONBOARDING' ? 'onboarding' : 'offboarding'} workflow</h2>
          <select
            className={`${dashboardFilterSelectClass} w-full`}
            value={startForm.employeeId}
            onChange={(e) => setStartForm((f) => ({ ...f, employeeId: e.target.value }))}
          >
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <select
            className={`${dashboardFilterSelectClass} w-full`}
            value={startForm.templateId}
            onChange={(e) => setStartForm((f) => ({ ...f, templateId: e.target.value }))}
          >
            <option value="">Default template (auto)</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="button" disabled={starting || !startForm.employeeId} className="btn-primary disabled:opacity-50" onClick={() => void startWorkflow()}>
              {starting ? 'Starting…' : 'Start'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setStartOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : null}

      <DashboardTableCard>
        <DashboardTableToolbar label={null}>
          <div className="flex w-full flex-wrap items-center gap-2">
            <div className="min-w-[200px] flex-1">
              <DashboardTableSearchInput
                value={filters.search}
                onChange={(value) => setFilter('search', value)}
                placeholder="Search employee name"
                className="pl-3"
              />
            </div>
            <label className="sr-only" htmlFor="onboarding-status">
              Status
            </label>
            <select
              id="onboarding-status"
              className={dashboardFilterSelectClass}
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            {hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className="btn-secondary text-xs">
                Clear filters
              </button>
            ) : null}
          </div>
        </DashboardTableToolbar>

        <DashboardAsyncState
          status={status}
          error={error}
          onRetry={reload}
          empty={
            <DashboardTableEmpty
              icon={<ClipboardList className="h-8 w-8 text-neutral-300" aria-hidden />}
              title="No workflows match this filter"
              description="Try a different status or search term."
            />
          }
        >
          <DashboardTableViewport>
            <DashboardTable>
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="col-center px-4 py-3">Started</th>
                  <th className="col-center px-4 py-3">Progress</th>
                  <th className="col-center px-4 py-3">Due tasks</th>
                  <th className="col-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {view.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/onboarding/${row.id}`}
                        className="font-medium text-primary-800 hover:underline"
                      >
                        {row.employee.firstName} {row.employee.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.employee.department?.name ?? '—'}</td>
                    <td className="col-center px-4 py-3 tabular-nums">{row.startedAt.slice(0, 10)}</td>
                    <td className="col-center px-4 py-3 tabular-nums">
                      {row.complete}/{row.total}
                    </td>
                    <td className="col-center px-4 py-3 tabular-nums">
                      {row.overdue > 0 ? row.overdue : '—'}
                    </td>
                    <td className="col-center px-4 py-3">{row.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        </DashboardAsyncState>
      </DashboardTableCard>
    </DashboardPage>
  );
}
