'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  departmentsSurfaceFromPathname,
  outsourcingDepartmentsApi,
  outsourcingEmployeesApi,
} from '@/lib/departments-surface';
import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2, Upload, Users, X } from 'lucide-react';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { dashboardAvatarClass, dashboardDeptInitials } from '@/lib/dashboard-avatar-palette';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DepartmentFormModal, type DepartmentRecord } from '@/components/outsourcing/DepartmentFormModal';
import { DepartmentImportModal } from '@/components/outsourcing/DepartmentImportModal';

function DepartmentsPageInner() {
  const pathname = usePathname();
  const surface = departmentsSurfaceFromPathname(pathname);
  const isOutsourcing = surface.mode === 'outsourcing';
  const outsourcingClient = useOutsourcingClient({ enabled: isOutsourcing });
  const clientId = isOutsourcing ? outsourcingClient.clientId : '';
  const clients = isOutsourcing ? outsourcingClient.clients : [];
  const setClientId = outsourcingClient.setClientId;
  const showSwitcher = isOutsourcing && outsourcingClient.showSwitcher;
  const clientsLoading = isOutsourcing ? outsourcingClient.loading : false;
  const apiBase = isOutsourcing
    ? (clientId ? outsourcingDepartmentsApi(clientId) : '')
    : surface.apiBase;
  const employeesApi = isOutsourcing
    ? (clientId ? outsourcingEmployeesApi(clientId) : '')
    : surface.employeesApi;
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<DepartmentRecord | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadDepartments = async () => {
    if (isOutsourcing && !clientId) {
      setDepartments([]);
      setLoading(false);
      return;
    }
    if (!apiBase) {
      setDepartments([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setLoading(true);
      const res = await fetch(apiBase);
      const data = await res.json().catch(() => []);
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      setDepartments([]);
      setError('Failed to load departments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientsLoading) return;
    void loadDepartments();
  }, [clientId, clientsLoading, apiBase, isOutsourcing]);

  const filteredDepartments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q
      ? departments.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            (d.code ?? '').toLowerCase().includes(q) ||
            (d.headName ?? '').toLowerCase().includes(q),
        )
      : departments;
    return [...list].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  }, [departments, searchQuery]);

  const totals = useMemo(() => {
    const active = departments.filter((d) => d.isActive);
    const deptCount = active.length;
    const staffCount = departments.reduce((sum, d) => sum + (d.employeeCount ?? 0), 0);
    const emptyDepts = active.filter((d) => (d.employeeCount ?? 0) === 0).length;
    const avgPerDept = deptCount > 0 ? Math.round((staffCount / deptCount) * 10) / 10 : 0;
    return { deptCount, staffCount, emptyDepts, avgPerDept };
  }, [departments]);

  const hasSearch = !!searchQuery.trim();

  const upsertDepartment = (dept: DepartmentRecord) => {
    setDepartments((prev) => {
      const exists = prev.some((d) => d.id === dept.id);
      return exists ? prev.map((d) => (d.id === dept.id ? { ...d, ...dept } : d)) : [...prev, dept];
    });
  };

  const handleToggleArchive = async (dept: DepartmentRecord) => {
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${dept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !dept.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update department.');
      upsertDepartment(data as DepartmentRecord);
      setNotice(dept.isActive ? `Archived "${dept.name}".` : `Restored "${dept.name}".`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update department.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget || (isOutsourcing && !clientId) || !apiBase) return;
    setConfirmBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${confirmTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete department.');
      setDepartments((prev) => prev.filter((d) => d.id !== confirmTarget.id));
      setNotice(`Deleted "${confirmTarget.name}".`);
      setConfirmTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete department.');
    } finally {
      setConfirmBusy(false);
    }
  };

  if (loading) {
    return (
      <DashboardPage>
        <div className="dashboard-surface h-48 animate-pulse shadow-sm" />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Departments"
        description="Group employees by department for org structure, payroll filters, and reporting."
        actions={
          <>
            {isOutsourcing ? (
              <button
                type="button"
                onClick={() => setShowImport(true)}
                disabled={!clientId}
                className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              disabled={isOutsourcing && !clientId}
              className="btn-primary inline-flex shrink-0 items-center gap-2 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add department
            </button>
          </>
        }
      />

      <DashboardStatGrid>
        <DashboardStatCard
          label="Departments"
          value={totals.deptCount}
          tone="primary"
          hint={hasSearch ? `${filteredDepartments.length} match search` : undefined}
        />
        <DashboardStatCard label="Staff assigned" value={totals.staffCount} tone="success" />
        <DashboardStatCard
          label="Empty departments"
          value={totals.emptyDepts}
          tone="warning"
          warn={totals.emptyDepts > 0}
          hint={totals.emptyDepts > 0 ? 'Open one to assign staff' : undefined}
        />
        <DashboardStatCard label="Avg per department" value={totals.avgPerDept} tone="violet" />
      </DashboardStatGrid>

      <div className="overflow-hidden dashboard-surface shadow-sm">
        <div className="dashboard-toolbar space-y-4 px-4 py-4 md:px-5">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              {showSwitcher ? (
                <OutsourcingClientSwitcher
                  clients={clients}
                  value={clientId}
                  onChange={setClientId}
                  className="sm:max-w-xs"
                />
              ) : null}
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, code, or head…"
                  className="h-10 w-full rounded-lg border border-neutral-200/80 bg-white/90 pl-9 pr-3 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900/80"
                />
              </div>
            </div>
            <p className="text-sm text-neutral-500">
              {hasSearch ? (
                <>
                  Showing <span className="font-medium tabular-nums text-ink">{filteredDepartments.length}</span> of{' '}
                  <span className="tabular-nums">{departments.length}</span>
                </>
              ) : (
                <>
                  <span className="font-medium tabular-nums text-ink">{departments.length}</span> department
                  {departments.length !== 1 ? 's' : ''}
                </>
              )}
            </p>
            {hasSearch ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="btn-secondary inline-flex h-10 items-center gap-1.5 px-3"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {departments.length === 0 ? (
          <p className="border-t border-neutral-100 px-4 py-12 text-center text-sm text-neutral-500 md:px-5">
            No departments yet. Add your first department, or import several at once.
          </p>
        ) : filteredDepartments.length === 0 ? (
          <p className="border-t border-neutral-100 px-4 py-12 text-center text-sm text-neutral-500 md:px-5">
            No departments match &quot;{searchQuery.trim()}&quot;.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--dash-border-subtle)] border-t border-[var(--dash-border-subtle)]">
            {filteredDepartments.map((dept) => (
              <li key={dept.id} className="group transition-colors hover:bg-[var(--dash-hover)]">
                <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
                  <Link
                    href={
                      isOutsourcing
                        ? `${surface.basePath}/${dept.id}?clientId=${encodeURIComponent(clientId ?? '')}`
                        : `${surface.basePath}/${dept.id}`
                    }
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${dashboardAvatarClass(dept.name)} ${dept.isActive ? '' : 'opacity-50 grayscale'}`}
                    >
                      {dashboardDeptInitials(dept.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-medium text-ink">
                        <span className="truncate">{dept.name}</span>
                        {dept.code ? (
                          <span className="shrink-0 rounded-md bg-[var(--dash-surface-raised)] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                            {dept.code}
                          </span>
                        ) : null}
                        {!dept.isActive ? (
                          <span className="shrink-0 rounded-md bg-neutral-200/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-700/60 dark:text-neutral-300">
                            Archived
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--dash-text-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {dept.employeeCount === 0
                            ? 'No employees'
                            : `${dept.employeeCount} employee${dept.employeeCount !== 1 ? 's' : ''}`}
                        </span>
                        {dept.headName ? <span className="truncate">· Head: {dept.headName}</span> : null}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(dept);
                        setShowForm(true);
                      }}
                      className="dash-table-icon-btn"
                      aria-label={`Edit ${dept.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleArchive(dept)}
                      className="dash-table-icon-btn"
                      aria-label={dept.isActive ? `Archive ${dept.name}` : `Restore ${dept.name}`}
                    >
                      {dept.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmTarget(dept)}
                      className="dash-table-icon-btn dash-table-icon-btn--danger"
                      aria-label={`Delete ${dept.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && apiBase ? (
        <DepartmentFormModal
          apiBase={apiBase}
          employeesApi={employeesApi}
          department={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={(dept) => {
            upsertDepartment(dept);
            setNotice(editing ? `Updated "${dept.name}".` : `Created "${dept.name}".`);
          }}
        />
      ) : null}

      {showImport && isOutsourcing && clientId ? (
        <DepartmentImportModal
          clientId={clientId}
          onClose={() => setShowImport(false)}
          onImported={(summary) => {
            void loadDepartments();
            setNotice(
              `Imported ${summary.created} department${summary.created !== 1 ? 's' : ''}` +
                (summary.skipped > 0 ? ` (${summary.skipped} skipped).` : '.'),
            );
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirmTarget}
        tone="danger"
        title={`Delete "${confirmTarget?.name ?? ''}"?`}
        description={
          confirmTarget && confirmTarget.employeeCount > 0 ? (
            <>
              This will unassign <span className="font-medium">{confirmTarget.employeeCount}</span> employee
              {confirmTarget.employeeCount !== 1 ? 's' : ''} from the department. Consider archiving instead to keep the
              history. This cannot be undone.
            </>
          ) : (
            'This permanently removes the department. This cannot be undone.'
          )
        }
        confirmLabel="Delete department"
        loading={confirmBusy}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setConfirmTarget(null)}
      />
    </DashboardPage>
  );
}

export default function DepartmentsPage() {
  return (
    <Suspense
      fallback={
        <DashboardPage>
          <div className="dashboard-surface h-48 animate-pulse shadow-sm" />
        </DashboardPage>
      }
    >
      <DepartmentsPageInner />
    </Suspense>
  );
}
