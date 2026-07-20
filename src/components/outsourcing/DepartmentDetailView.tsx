'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, Pencil, Search, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';
import { DepartmentFormModal, type DepartmentRecord } from '@/components/outsourcing/DepartmentFormModal';

type RosterMember = {
  id: string;
  employeeNumber: string | null;
  name: string;
  jobTitle: string | null;
  employmentStatus: string;
  baseSalary: number | null;
};

type DepartmentDetail = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  headEmployeeId: string | null;
  head: { id: string; name: string; jobTitle: string | null } | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  isActive: boolean;
  employeeCount: number;
  payroll: { canView: boolean; withSalary: number; totalBaseSalary: number | null; avgBaseSalary: number | null };
  employees: RosterMember[];
};

const currency = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  probation: 'Probation',
  on_leave: 'On leave',
  suspended: 'Suspended',
  terminated: 'Terminated',
};

export function DepartmentDetailView({ departmentId, backHref }: { departmentId: string; backHref: string }) {
  const { clientId: hookClientId, loading: clientsLoading } = useOutsourcingClient();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId') || hookClientId || '';

  const [detail, setDetail] = useState<DepartmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const res = await fetch(`/api/outsourcing/clients/${clientId}/departments/${departmentId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load department.');
      setDetail(data as DepartmentDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load department.');
    } finally {
      setLoading(false);
    }
  }, [clientId, departmentId]);

  useEffect(() => {
    if (clientsLoading) return;
    void load();
  }, [clientsLoading, load]);

  const handleUnassign = async (memberId: string) => {
    if (!clientId) return;
    setBusyId(memberId);
    setError(null);
    try {
      const res = await fetch('/api/outsourcing/employees/bulk-assign-department', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: [memberId], departmentId: null, clientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to unassign employee.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unassign employee.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <DashboardPage>
        <div className="dashboard-surface h-40 animate-pulse shadow-sm" />
        <div className="dashboard-surface mt-4 h-64 animate-pulse shadow-sm" />
      </DashboardPage>
    );
  }

  if (error && !detail) {
    return (
      <DashboardPage>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
          {error}
        </div>
        <Link href={backHref} className="btn-secondary mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back to departments
        </Link>
      </DashboardPage>
    );
  }

  if (!detail) {
    return (
      <DashboardPage>
        <p className="dashboard-surface p-8 text-center text-sm text-neutral-500 shadow-sm">Department not found.</p>
      </DashboardPage>
    );
  }

  const editRecord: DepartmentRecord = {
    id: detail.id,
    name: detail.name,
    code: detail.code,
    description: detail.description,
    headEmployeeId: detail.headEmployeeId,
    headName: detail.head?.name ?? null,
    costCenterCode: detail.costCenterCode,
    costCenterName: detail.costCenterName,
    isActive: detail.isActive,
    employeeCount: detail.employeeCount,
  };

  const costCentre = detail.costCenterCode || detail.costCenterName
    ? [detail.costCenterCode, detail.costCenterName].filter(Boolean).join(' · ')
    : null;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title={
          <span className="flex items-center gap-2">
            {detail.name}
            {detail.code ? (
              <span className="rounded-md bg-[var(--dash-surface-raised)] px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                {detail.code}
              </span>
            ) : null}
            {!detail.isActive ? (
              <span className="rounded-md bg-neutral-200/70 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300">
                Archived
              </span>
            ) : null}
          </span>
        }
        description={detail.description || undefined}
        meta={
          <Link href={backHref} className="inline-flex items-center gap-1.5 hover:text-[var(--dash-text)]">
            <ArrowLeft className="h-3.5 w-3.5" />
            All departments
          </Link>
        }
        badges={[
          detail.head
            ? { label: `Head: ${detail.head.name}`, icon: Users }
            : { label: 'No department head', icon: Users },
          ...(costCentre ? [{ label: `Cost centre: ${costCentre}` }] : []),
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAssign(true)}
              className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              <UserPlus className="h-4 w-4" />
              Assign employees
            </button>
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          </div>
        }
      />

      <DashboardStatGrid>
        <DashboardStatCard label="Headcount" value={detail.employeeCount} tone="primary" />
        <DashboardStatCard
          label="Monthly base payroll"
          value={detail.payroll.canView && detail.payroll.totalBaseSalary != null ? currency.format(detail.payroll.totalBaseSalary) : '—'}
          tone="success"
          hint={detail.payroll.canView ? `${detail.payroll.withSalary} with salary set` : 'Restricted'}
        />
        <DashboardStatCard
          label="Average base pay"
          value={detail.payroll.canView && detail.payroll.avgBaseSalary != null ? currency.format(detail.payroll.avgBaseSalary) : '—'}
          tone="violet"
        />
        <DashboardStatCard
          label="Status"
          value={detail.isActive ? 'Active' : 'Archived'}
          tone={detail.isActive ? 'success' : 'warning'}
        />
      </DashboardStatGrid>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden dashboard-surface shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--dash-border-subtle)] px-4 py-3 md:px-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--dash-text)]">
            <Users className="h-4 w-4 text-[var(--dash-text-muted)]" />
            Roster
            <span className="text-[var(--dash-text-muted)]">({detail.employeeCount})</span>
          </h2>
        </div>

        {detail.employees.length === 0 ? (
          <div className="px-4 py-12 text-center md:px-5">
            <p className="text-sm text-neutral-500">No employees assigned to this department yet.</p>
            <button
              type="button"
              onClick={() => setShowAssign(true)}
              className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              <UserPlus className="h-4 w-4" />
              Assign employees
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--dash-border-subtle)]">
            {detail.employees.map((emp) => (
              <li key={emp.id} className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--dash-hover)] md:px-5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {emp.name}
                    {emp.employeeNumber ? (
                      <span className="ml-2 font-mono text-xs text-[var(--dash-text-muted)]">#{emp.employeeNumber}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--dash-text-muted)]">
                    <span>{emp.jobTitle || 'No job title'}</span>
                    <span>· {STATUS_LABELS[emp.employmentStatus] ?? emp.employmentStatus}</span>
                    {emp.baseSalary != null ? <span>· {currency.format(emp.baseSalary)}</span> : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleUnassign(emp.id)}
                  disabled={busyId === emp.id}
                  className="dash-table-icon-btn shrink-0 opacity-100 disabled:opacity-50 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                  aria-label={`Remove ${emp.name} from department`}
                  title="Remove from department"
                >
                  {busyId === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showEdit ? (
        <DepartmentFormModal
          clientId={clientId}
          department={editRecord}
          onClose={() => setShowEdit(false)}
          onSaved={() => void load()}
        />
      ) : null}

      {showAssign ? (
        <AssignEmployeesModal
          clientId={clientId}
          departmentId={detail.id}
          departmentName={detail.name}
          onClose={() => setShowAssign(false)}
          onAssigned={() => void load()}
        />
      ) : null}
    </DashboardPage>
  );
}

type AssignableEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
};

function AssignEmployeesModal({
  clientId,
  departmentId,
  departmentName,
  onClose,
  onAssigned,
}: {
  clientId: string;
  departmentId: string;
  departmentName: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/outsourcing/employees?clientId=${encodeURIComponent(clientId)}&limit=500`);
        const data = await res.json().catch(() => []);
        if (!cancelled) setEmployees(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError('Failed to load employees.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const assignable = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter((e) => e.departmentId !== departmentId)
      .filter((e) => {
        if (!q) return true;
        return `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || (e.jobTitle ?? '').toLowerCase().includes(q);
      });
  }, [employees, departmentId, query]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  async function handleAssign() {
    if (selected.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/outsourcing/employees/bulk-assign-department', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: selected, departmentId, clientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to assign employees.');
      onAssigned();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign employees.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-employees-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--dash-border)] px-5 py-4">
          <div>
            <h2 id="assign-employees-title" className="text-lg font-semibold text-[var(--dash-text)]">
              Assign employees
            </h2>
            <p className="mt-0.5 text-sm text-[var(--dash-text-muted)]">
              Move employees into <span className="font-medium">{departmentName}</span>. Those already elsewhere will be
              reassigned.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
              {error}
            </div>
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employees…"
              className="h-10 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-[var(--dash-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading employees…
            </div>
          ) : assignable.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--dash-text-muted)]">
              {employees.length === 0 ? 'No employees for this client yet.' : 'Everyone is already in this department.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {assignable.map((emp) => {
                const checked = selected.includes(emp.id);
                return (
                  <li key={emp.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[var(--dash-hover)]">
                      <input type="checkbox" checked={checked} onChange={() => toggle(emp.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">
                          {emp.firstName} {emp.lastName}
                        </span>
                        <span className="block truncate text-xs text-[var(--dash-text-muted)]">
                          {emp.jobTitle || 'No job title'}
                          {emp.departmentName ? ` · currently ${emp.departmentName}` : ' · unassigned'}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--dash-border)] px-5 py-3">
          <span className="text-xs text-[var(--dash-text-muted)]">
            {selected.length > 0 ? `${selected.length} selected` : 'Select employees to assign'}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleAssign()}
              disabled={saving || selected.length === 0}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Assign{selected.length > 0 ? ` ${selected.length}` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
