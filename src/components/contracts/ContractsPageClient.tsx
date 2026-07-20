'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileSignature,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatGrid, DashboardStatCard } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTableCard,
  DashboardTableToolbar,
  DashboardTableViewport,
  DashboardTable,
  DashboardTableEmpty,
  DashboardTableFooter,
  DashboardTableActions,
  DashboardTableActionButton,
} from '@/components/dashboard/DashboardDataTable';
import {
  DashboardFilterBar,
  dashboardFilterInputClass,
} from '@/components/dashboard/DashboardFilterBar';
import { DashboardPagination } from '@/components/dashboard/DashboardPagination';
import { DashboardAsyncState, type DashboardAsyncStatus } from '@/components/dashboard/DashboardAsyncState';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { ExportButton } from '@/components/dashboard/ExportButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';

type ContractStatus = 'active' | 'expiring' | 'expired';

type ContractItem = {
  id: string;
  title: string | null;
  reference: string | null;
  contractType: 'employee' | 'consultant';
  startDate: string | null;
  endDate: string;
  status: ContractStatus;
  remindersDisabled: boolean;
  managers: Array<{ id: string; name: string; email: string }>;
};

type StaffUser = { id: string; name: string; email: string };

type SortField = 'endDate' | 'title' | 'type';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<ContractStatus, DashStatusTone> = {
  active: 'success',
  expiring: 'warning',
  expired: 'danger',
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  active: 'Active',
  expiring: 'Expiring',
  expired: 'Expired',
};

function addMonths(isoDate: string, months: number) {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

const emptyForm = {
  contractType: 'employee' as 'employee' | 'consultant',
  partyName: '',
  reference: '',
  startDate: '',
  endDate: '',
  remindersDisabled: false,
  managerIds: [] as string[],
};

export default function ContractsPageClient() {
  const router = useRouter();

  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [managers, setManagers] = useState<StaffUser[]>([]);
  const [stats, setStats] = useState({ total: 0, employee: 0, consultant: 0, expiring: 0, expired: 0 });

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'endDate', dir: 'asc' });
  const [page, setPage] = useState(1);

  const [openCreate, setOpenCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [renewTarget, setRenewTarget] = useState<ContractItem | null>(null);
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewing, setRenewing] = useState(false);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter/sort change resets to the first page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, statusFilter, sort.field, sort.dir]);

  const buildQuery = useCallback(
    (includePagination: boolean) => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('sort', sort.field);
      params.set('dir', sort.dir);
      if (includePagination) {
        params.set('page', String(page));
        params.set('pageSize', String(PAGE_SIZE));
      }
      return params;
    },
    [debouncedSearch, typeFilter, statusFilter, sort.field, sort.dir, page],
  );

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/people/contracts?${buildQuery(true).toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load contracts');
      setContracts(Array.isArray(data.contracts) ? data.contracts : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
    } catch (e) {
      setContracts([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/people/contracts', { cache: 'no-store' });
      const data = await res.json().catch(() => []);
      const rows: ContractItem[] = Array.isArray(data) ? data : [];
      setStats({
        total: rows.length,
        employee: rows.filter((c) => c.contractType === 'employee').length,
        consultant: rows.filter((c) => c.contractType === 'consultant').length,
        expiring: rows.filter((c) => c.status === 'expiring').length,
        expired: rows.filter((c) => c.status === 'expired').length,
      });
    } catch {
      // Stats are non-critical; leave prior values.
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    fetch('/api/users?contractManagerPicker=1', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setManagers(
          Array.isArray(data)
            ? data.map((u: StaffUser) => ({ id: u.id, name: u.name, email: u.email }))
            : [],
        );
      })
      .catch(() => setManagers([]));
  }, []);

  const hasActiveFilters = Boolean(debouncedSearch || typeFilter || statusFilter);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setStatusFilter('');
  };

  const toggleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'asc' },
    );
  };

  const openCreateModal = () => {
    setForm(emptyForm);
    setOpenCreate(true);
  };

  const handleCreate = async () => {
    if (!form.partyName.trim() || !form.endDate) {
      toast.error('Party name and end date are required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/people/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create contract');
      toast.success('Contract created.');
      setOpenCreate(false);
      setForm(emptyForm);
      await Promise.all([loadContracts(), loadStats()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create contract');
    } finally {
      setSubmitting(false);
    }
  };

  const openRenew = (contract: ContractItem) => {
    setRenewTarget(contract);
    setRenewEndDate(addMonths(contract.endDate, 12));
  };

  const handleRenew = async () => {
    if (!renewTarget || !renewEndDate) return;
    setRenewing(true);
    try {
      const start = new Date(`${renewTarget.endDate}T12:00:00`);
      start.setDate(start.getDate() + 1);
      const res = await fetch(`/api/people/contracts/${renewTarget.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStartDate: start.toISOString().slice(0, 10),
          newEndDate: renewEndDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to renew contract');
      toast.success('Contract renewed.');
      setRenewTarget(null);
      if (data.id) {
        router.push(`/dashboard/people/contracts/${data.id}`);
      } else {
        await Promise.all([loadContracts(), loadStats()]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to renew contract');
    } finally {
      setRenewing(false);
    }
  };

  const exportOptions = useMemo(() => {
    const qs = buildQuery(false).toString();
    return (['csv', 'xlsx', 'pdf'] as const).map((format) => ({
      format,
      label: format === 'csv' ? 'CSV' : format === 'xlsx' ? 'Excel (.xlsx)' : 'PDF',
      href: `/api/people/contracts/export?format=${format}&${qs}`,
    }));
  }, [buildQuery]);

  const status: DashboardAsyncStatus = loading
    ? 'loading'
    : error
      ? 'error'
      : contracts.length === 0
        ? 'empty'
        : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Contracts"
        icon={FileSignature}
        description="Manage both employee contracts and consultant doctor contracts with renewal reminders."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton options={exportOptions} />
            <button
              type="button"
              onClick={openCreateModal}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New contract
            </button>
          </div>
        }
      />

      <DashboardStatGrid columns={6}>
        <DashboardStatCard label="Total" value={stats.total} tone="primary" />
        <DashboardStatCard label="Employee" value={stats.employee} tone="sky" />
        <DashboardStatCard label="Consultant" value={stats.consultant} tone="violet" />
        <DashboardStatCard label="Expiring soon" value={stats.expiring} tone="warning" warn hint="Within 60 days" />
        <DashboardStatCard label="Expired" value={stats.expired} tone="warning" />
      </DashboardStatGrid>

      <DashboardTableCard>
        <DashboardTableToolbar label={null}>
          <DashboardFilterBar
            label={null}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          >
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, reference, or manager…"
              aria-label="Search contracts"
              className={`${dashboardFilterInputClass} sm:w-72`}
            />
            <StrideSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: '', label: 'All types' },
                { value: 'employee', label: 'Employee' },
                { value: 'consultant', label: 'Consultant' },
              ]}
              ariaLabel="Filter by type"
              className="w-44"
            />
            <StrideSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'expiring', label: 'Expiring' },
                { value: 'expired', label: 'Expired' },
              ]}
              ariaLabel="Filter by status"
              className="w-44"
            />
          </DashboardFilterBar>
        </DashboardTableToolbar>

        <DashboardAsyncState
          status={status}
          error={error}
          onRetry={() => void loadContracts()}
          empty={
            <DashboardTableEmpty
              icon={<FileSignature className="h-8 w-8 text-neutral-300" aria-hidden />}
              title="No contracts found"
              description={
                hasActiveFilters
                  ? 'Try adjusting your search or filters.'
                  : 'Create your first contract to get started.'
              }
            />
          }
        >
          <DashboardTableViewport minWidth={920}>
            <DashboardTable>
              <thead>
                <tr>
                  <SortableHeader
                    label="Type"
                    field="type"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    label="Contract party"
                    field="title"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Start</th>
                  <SortableHeader
                    label="End"
                    field="endDate"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Managers</th>
                  <th className="px-3 py-2">Reminders</th>
                  <th className="px-3 py-2 col-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/people/contracts/${c.id}`)}
                  >
                    <td className="px-3 py-2">
                      <span
                        className={dashStatusChip(c.contractType === 'consultant' ? 'info' : 'neutral')}
                      >
                        {c.contractType === 'consultant' ? 'Consultant' : 'Employee'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-[var(--dash-text-strong)]">
                      {c.title || '—'}
                    </td>
                    <td className="px-3 py-2 text-[var(--dash-text-muted)]">{c.reference || '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-[var(--dash-text-muted)]">
                      {c.startDate || '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{c.endDate}</td>
                    <td className="px-3 py-2">
                      <span className={dashStatusChip(STATUS_TONE[c.status])}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[var(--dash-text-muted)]">
                      {c.managers.length ? c.managers.map((m) => m.name).join(', ') : '—'}
                    </td>
                    <td className="px-3 py-2 text-[var(--dash-text-muted)]">
                      {c.remindersDisabled ? 'Disabled' : 'Enabled'}
                    </td>
                    <td className="px-3 py-2 col-center" onClick={(e) => e.stopPropagation()}>
                      <DashboardTableActions>
                        <DashboardTableActionButton onClick={() => openRenew(c)} title="Renew contract">
                          <RefreshCw className="h-3.5 w-3.5" />
                          Renew
                        </DashboardTableActionButton>
                        <DashboardTableActionButton
                          variant="primary"
                          onClick={() => router.push(`/dashboard/people/contracts/${c.id}`)}
                        >
                          Open
                        </DashboardTableActionButton>
                      </DashboardTableActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
          <DashboardTableFooter>
            <DashboardPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
              itemLabel="contracts"
            />
          </DashboardTableFooter>
        </DashboardAsyncState>
      </DashboardTableCard>

      <DashboardModal
        open={openCreate}
        onClose={() => (submitting ? undefined : setOpenCreate(false))}
        title="New contract"
        size="lg"
        dismissible={!submitting}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpenCreate(false)}
              disabled={submitting}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save contract
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contract type">
            <StrideSelect
              value={form.contractType}
              onChange={(value) =>
                setForm((f) => ({ ...f, contractType: value as 'employee' | 'consultant' }))
              }
              options={[
                { value: 'employee', label: 'Employee contract' },
                { value: 'consultant', label: 'Consultant doctor contract' },
              ]}
              ariaLabel="Contract type"
            />
          </Field>
          <Field label={form.contractType === 'employee' ? 'Employee full name' : 'Consultant doctor full name'}>
            <input
              value={form.partyName}
              onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))}
              placeholder="Full name"
              className={dashboardFilterInputClass}
            />
          </Field>
          <Field label="Reference (optional)">
            <input
              value={form.reference}
              onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="e.g. 2026-014"
              className={dashboardFilterInputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className={dashboardFilterInputClass}
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className={dashboardFilterInputClass}
              />
            </Field>
          </div>
        </div>

        {managers.length ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[var(--dash-text-muted)]">Contract managers</p>
            <div className="flex flex-wrap gap-2">
              {managers.map((m) => {
                const checked = form.managerIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-2.5 py-1.5 text-xs text-[var(--dash-text)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          managerIds: e.target.checked
                            ? [...f.managerIds, m.id]
                            : f.managerIds.filter((id) => id !== m.id),
                        }))
                      }
                    />
                    {m.name}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--dash-text)]">
          <input
            type="checkbox"
            checked={form.remindersDisabled}
            onChange={(e) => setForm((f) => ({ ...f, remindersDisabled: e.target.checked }))}
          />
          Disable expiry reminders
        </label>
      </DashboardModal>

      <ConfirmDialog
        open={renewTarget !== null}
        title="Renew contract"
        tone="default"
        confirmLabel="Renew"
        loading={renewing}
        onCancel={() => (renewing ? undefined : setRenewTarget(null))}
        onConfirm={handleRenew}
        description={
          <div className="space-y-3">
            <p>
              Creates a new contract for{' '}
              <span className="font-medium text-[var(--dash-text)]">
                {renewTarget?.title || 'this party'}
              </span>{' '}
              starting the day after the current one ends, carrying over managers.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dash-text-muted)]">
                New end date
              </label>
              <input
                type="date"
                value={renewEndDate}
                onChange={(e) => setRenewEndDate(e.target.value)}
                className={dashboardFilterInputClass}
              />
            </div>
          </div>
        }
      />
    </DashboardPage>
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

function SortableHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: SortField;
  sort: { field: SortField; dir: SortDir };
  onSort: (field: SortField) => void;
}) {
  const active = sort.field === field;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className="px-3 py-2">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-[var(--dash-text-strong)]"
        aria-label={`Sort by ${label}`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? 'text-primary-600' : 'text-neutral-400'}`} aria-hidden />
      </button>
    </th>
  );
}
