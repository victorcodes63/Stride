'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  FileSignature,
  Loader2,
  Paperclip,
  Plus,
  Scale,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableFooter,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardFilterBar } from '@/components/dashboard/DashboardFilterBar';
import { DashboardPagination } from '@/components/dashboard/DashboardPagination';
import { ExportButton } from '@/components/dashboard/ExportButton';
import { StrideSelect } from '@/components/ui/stride-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { useSortableTable, type SortDirection } from '@/hooks/useSortableTable';
import { LegalStatusBadge, PriorityBadge, RegisterStatusBadge } from '@/components/legal/LegalBadges';
import {
  CATEGORY_LABEL,
  OBLIGATION_CATEGORIES,
  OBLIGATION_PRIORITIES,
  OBLIGATION_STATUSES,
  PRIORITY_LABEL,
  STATUS_LABEL,
  selectOptions,
  type LegalObligationCategory,
  type LegalObligationPriority,
  type ObligationRegisterStatus,
} from '@/lib/legal/constants';
import { ObligationFormModal } from '@/components/legal/ObligationFormModal';
import { ObligationDetailDrawer } from '@/components/legal/ObligationDetailDrawer';
import {
  EMPTY_OBLIGATION_FORM,
  type ObligationDetail,
  type ObligationFormState,
  type ObligationListResponse,
  type ObligationOwner,
  type ObligationRecord,
} from '@/components/legal/ObligationTypes';

type SortKey = 'dueDate' | 'priority' | 'title' | 'status';
const PAGE_SIZE = 20;

type RegisterRow = {
  id: string;
  source: 'contract' | 'credential' | 'policy' | 'compliance';
  title: string;
  party: string;
  dueDate: string;
  status: ObligationRegisterStatus;
  owner: string | null;
  href: string;
  category?: string | null;
};

const CATEGORY_OPTIONS = selectOptions(OBLIGATION_CATEGORIES, CATEGORY_LABEL);
const PRIORITY_OPTIONS = selectOptions(OBLIGATION_PRIORITIES, PRIORITY_LABEL);
const STATUS_OPTIONS = selectOptions(OBLIGATION_STATUSES, STATUS_LABEL);

const SOURCE_LABEL: Record<RegisterRow['source'], string> = {
  contract: 'Contract',
  credential: 'Credential',
  policy: 'Policy',
  compliance: 'Obligation',
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned ${res.status}. Check the API is up and migrations are applied.`);
  }
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? `Request failed (${res.status}).`;
    throw new Error(message);
  }
  return data as T;
}

export default function LegalObligationsPage() {
  const [records, setRecords] = useState<ObligationRecord[]>([]);
  const [owners, setOwners] = useState<ObligationOwner[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, dueSoon: 0, overdue: 0, completed: 0 });
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { sort, toggleSort, getSortDirection } = useSortableTable<SortKey>({
    key: 'dueDate',
    direction: 'asc',
  });

  // Modal + drawer + confirm state.
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ObligationFormState>(EMPTY_OBLIGATION_FORM);
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ObligationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [waiveReason, setWaiveReason] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter, priorityFilter, ownerFilter, search, sort.key, sort.direction]);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    params.set('sort', sort.key);
    params.set('dir', sort.direction);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (ownerFilter) params.set('ownerUserId', ownerFilter);
    if (search) params.set('q', search);
    return `/api/legal/obligations/records?${params.toString()}`;
  }, [page, sort.key, sort.direction, statusFilter, categoryFilter, priorityFilter, ownerFilter, search]);

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('sort', sort.key);
    params.set('dir', sort.direction);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (priorityFilter) params.set('priority', priorityFilter);
    if (ownerFilter) params.set('ownerUserId', ownerFilter);
    if (search) params.set('q', search);
    return params.toString();
  }, [sort.key, sort.direction, statusFilter, categoryFilter, priorityFilter, ownerFilter, search]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jsonFetch<ObligationListResponse>(listUrl);
      setRecords(data.records ?? []);
      setTotal(data.total ?? 0);
      setOwners(data.owners ?? []);
      setSummary(data.summary ?? { total: 0, dueSoon: 0, overdue: 0, completed: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load obligations.');
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  const loadRegister = useCallback(async () => {
    try {
      const data = await jsonFetch<{ obligations?: RegisterRow[] }>('/api/legal/obligations');
      setRegisterRows(data.obligations ?? []);
    } catch {
      // Aggregated register is supplementary; ignore its failures here.
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadRegister();
  }, [loadRegister]);

  const hasActiveFilters = Boolean(
    statusFilter || categoryFilter || priorityFilter || ownerFilter || search,
  );

  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    setOwnerFilter('');
    setSearchInput('');
    setSearch('');
  };

  // --- Create / edit --------------------------------------------------------
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_OBLIGATION_FORM);
    setFormOpen(true);
  };

  const openEdit = (record: ObligationRecord) => {
    setEditingId(record.id);
    setForm({
      title: record.title,
      category: record.category,
      priority: record.priority,
      dueDate: record.dueDate,
      reminderDays: String(record.reminderDays),
      recurrenceMonths: record.recurrenceMonths != null ? String(record.recurrenceMonths) : '',
      ownerUserId: record.owner?.id ?? '',
      regulator: record.regulator ?? '',
      description: record.description ?? '',
      notes: record.notes ?? '',
    });
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!form.title.trim()) return toast.error('Title is required.');
    if (!form.dueDate) return toast.error('Due date is required.');
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        category: form.category,
        priority: form.priority,
        dueDate: form.dueDate,
        reminderDays: form.reminderDays ? Number(form.reminderDays) : 30,
        recurrenceMonths: form.recurrenceMonths ? Number(form.recurrenceMonths) : null,
        ownerUserId: form.ownerUserId || null,
        regulator: form.regulator.trim() || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        await jsonFetch(`/api/legal/obligations/records/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success('Obligation updated');
      } else {
        await jsonFetch('/api/legal/obligations/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success('Obligation created');
      }
      setFormOpen(false);
      await Promise.all([loadList(), loadRegister(), detailId ? refreshDetail(detailId) : Promise.resolve()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save obligation.');
    } finally {
      setSaving(false);
    }
  };

  // --- Detail ---------------------------------------------------------------
  const refreshDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await jsonFetch<ObligationDetail>(`/api/legal/obligations/records/${id}`);
      setDetail(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load obligation.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetail(null);
    void refreshDetail(id);
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
  };

  const patchDetail = async (body: Record<string, unknown>, successMsg: string) => {
    if (!detailId) return;
    setActionBusy(true);
    try {
      await jsonFetch(`/api/legal/obligations/records/${detailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.success(successMsg);
      await Promise.all([refreshDetail(detailId), loadList(), loadRegister()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAssign = (ownerUserId: string) => {
    if (detail && (detail.owner?.id ?? '') === ownerUserId) return;
    void patchDetail({ ownerUserId: ownerUserId || null }, 'Owner updated');
  };

  const handleComplete = () => void patchDetail({ status: 'completed' }, 'Obligation completed');
  const handleReopen = () => void patchDetail({ status: 'pending' }, 'Obligation reopened');

  const confirmWaive = async () => {
    if (!waiveReason.trim()) return toast.error('A waiver reason is required.');
    await patchDetail({ status: 'waived', waivedReason: waiveReason.trim() }, 'Obligation waived');
    setWaiveOpen(false);
    setWaiveReason('');
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setActionBusy(true);
    try {
      await jsonFetch(`/api/legal/obligations/records/${deleteId}`, { method: 'DELETE' });
      toast.success('Obligation deleted');
      setDeleteId(null);
      if (detailId === deleteId) closeDetail();
      await Promise.all([loadList(), loadRegister()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setActionBusy(false);
    }
  };

  // --- Evidence -------------------------------------------------------------
  const handleUploadEvidence = async (file: File) => {
    if (!detailId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await jsonFetch(`/api/legal/obligations/records/${detailId}/evidence`, {
        method: 'POST',
        body: fd,
      });
      toast.success('Evidence uploaded');
      await Promise.all([refreshDetail(detailId), loadList()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveEvidence = async () => {
    if (!detailId) return;
    setUploading(true);
    try {
      await jsonFetch(`/api/legal/obligations/records/${detailId}/evidence`, { method: 'DELETE' });
      toast.success('Evidence removed');
      await Promise.all([refreshDetail(detailId), loadList()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Scale}
        title="Obligations register"
        description="Statutory filings, permits, board actions, and regulator deadlines — with owners, evidence, and reminders."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              options={[
                { format: 'csv', label: 'Export CSV', href: `/api/legal/obligations/records/export?format=csv&${exportQuery}` },
                { format: 'xlsx', label: 'Export Excel', href: `/api/legal/obligations/records/export?format=xlsx&${exportQuery}` },
                { format: 'pdf', label: 'Export PDF', href: `/api/legal/obligations/records/export?format=pdf&${exportQuery}` },
              ]}
            />
            <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2 shrink-0">
              <Plus className="h-4 w-4" /> Add obligation
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/dashboard/people/contracts" className="btn-secondary inline-flex items-center gap-2">
          <FileSignature className="h-4 w-4" /> Contracts
        </Link>
        <Link href="/dashboard/credentials" className="btn-secondary inline-flex items-center gap-2">
          <BadgeCheck className="h-4 w-4" /> Credentials
        </Link>
        <Link href="/dashboard/company-documents" className="btn-secondary inline-flex items-center gap-2">
          Company policies
        </Link>
      </div>

      <DashboardStatGrid columns={4}>
        <DashboardStatCard label="Total obligations" value={summary.total} tone="primary" />
        <DashboardStatCard label="Due ≤ 60 days" value={summary.dueSoon} tone="warning" warn={summary.dueSoon > 0} />
        <DashboardStatCard label="Overdue" value={summary.overdue} tone="warning" warn={summary.overdue > 0} />
        <DashboardStatCard label="Completed" value={summary.completed} tone="success" />
      </DashboardStatGrid>

      <DashboardTableCard>
        <DashboardTableToolbar label={null}>
          <DashboardFilterBar label={null} hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
            <div className="relative min-w-[220px] flex-1">
              <DashboardTableSearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search title or regulator…"
                className="pl-3"
              />
            </div>
            <StrideSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: '', label: 'All statuses' }, ...STATUS_OPTIONS]}
              ariaLabel="Status filter"
              className="w-full sm:w-40"
            />
            <StrideSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: '', label: 'All categories' }, ...CATEGORY_OPTIONS]}
              ariaLabel="Category filter"
              className="w-full sm:w-48"
            />
            <StrideSelect
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[{ value: '', label: 'All priorities' }, ...PRIORITY_OPTIONS]}
              ariaLabel="Priority filter"
              className="w-full sm:w-40"
            />
            <StrideSelect
              value={ownerFilter}
              onChange={setOwnerFilter}
              options={[
                { value: '', label: 'All owners' },
                ...owners.map((o) => ({ value: o.id, label: o.name })),
              ]}
              ariaLabel="Owner filter"
              className="w-full sm:w-48"
            />
          </DashboardFilterBar>
        </DashboardTableToolbar>

        {error ? (
          <div className="m-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        ) : null}

        <DashboardTableViewport minWidth={980}>
          <DashboardTable className="text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50/80 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <SortHeader label="Due date" sortKey="dueDate" active={getSortDirection('dueDate')} onSort={toggleSort} />
                <SortHeader label="Title" sortKey="title" active={getSortDirection('title')} onSort={toggleSort} />
                <th className="px-4 py-3">Category</th>
                <SortHeader label="Priority" sortKey="priority" active={getSortDirection('priority')} onSort={toggleSort} />
                <SortHeader label="Status" sortKey="status" active={getSortDirection('status')} onSort={toggleSort} />
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Regulator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading obligations…
                    </span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <DashboardTableEmpty
                  colSpan={7}
                  icon={<Scale className="h-8 w-8 text-neutral-300" aria-hidden />}
                  title="No obligations found"
                  description="Add a statutory filing, permit, or regulator deadline to start tracking compliance."
                />
              ) : (
                records.map((record) => (
                  <tr
                    key={record.id}
                    className="cursor-pointer hover:bg-neutral-50/60"
                    onClick={() => openDetail(record.id)}
                  >
                    <td className="px-4 py-3 tabular-nums text-neutral-700">{record.dueDate}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                        {record.title}
                        {record.evidencePath ? (
                          <Paperclip className="h-3.5 w-3.5 text-primary-500" aria-label="Has evidence" />
                        ) : null}
                      </span>
                      {record.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{record.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{CATEGORY_LABEL[record.category]}</td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={record.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <LegalStatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{record.owner?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-neutral-600">{record.regulator ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </DashboardTable>
        </DashboardTableViewport>

        {total > 0 ? (
          <DashboardTableFooter>
            <DashboardPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
              itemLabel="obligations"
            />
          </DashboardTableFooter>
        ) : null}
      </DashboardTableCard>

      <DashboardTableCard>
        <div className="border-b border-neutral-200/80 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-ink">Full obligations register</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Aggregated view from contracts, credentials, policies, and custom obligations.
          </p>
        </div>
        <DashboardTableViewport minWidth={880}>
          <DashboardTable className="text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50/80 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Due date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Obligation</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {registerRows.length === 0 ? (
                <DashboardTableEmpty
                  colSpan={6}
                  title="Nothing tracked yet"
                  description="Add contracts, credentials, or policies with expiry dates to populate this view."
                />
              ) : (
                registerRows.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/60">
                    <td className="px-4 py-3 tabular-nums text-neutral-700">{row.dueDate}</td>
                    <td className="px-4 py-3 text-neutral-600">{SOURCE_LABEL[row.source]}</td>
                    <td className="px-4 py-3">
                      <Link href={row.href} className="font-medium text-ink hover:underline">
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{row.party}</td>
                    <td className="px-4 py-3 text-neutral-600">{row.owner ?? '—'}</td>
                    <td className="px-4 py-3">
                      <RegisterStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </DashboardTable>
        </DashboardTableViewport>
      </DashboardTableCard>

      <ObligationFormModal
        open={formOpen}
        editing={editingId !== null}
        form={form}
        owners={owners}
        saving={saving}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onClose={() => setFormOpen(false)}
        onSubmit={() => void submitForm()}
      />

      <ObligationDetailDrawer
        open={detailId !== null}
        onClose={closeDetail}
        detail={detail}
        loading={detailLoading}
        owners={owners}
        busy={actionBusy}
        uploading={uploading}
        onAssign={handleAssign}
        onComplete={handleComplete}
        onWaive={() => {
          setWaiveReason('');
          setWaiveOpen(true);
        }}
        onReopen={handleReopen}
        onDelete={() => detailId && setDeleteId(detailId)}
        onEdit={() => detail && openEdit(detail)}
        onUploadEvidence={(file) => void handleUploadEvidence(file)}
        onRemoveEvidence={() => void handleRemoveEvidence()}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete obligation?"
        description="This permanently removes the obligation and its activity history."
        tone="danger"
        confirmLabel="Delete"
        loading={actionBusy}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={waiveOpen}
        title="Waive obligation?"
        description={
          <div className="space-y-2">
            <p>Record why this obligation is being waived. This is kept in the activity history.</p>
            <textarea
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              rows={3}
              placeholder="Reason for waiving…"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </div>
        }
        confirmLabel="Waive obligation"
        loading={actionBusy}
        onCancel={() => setWaiveOpen(false)}
        onConfirm={() => void confirmWaive()}
      />
    </DashboardPage>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: SortDirection | null;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide hover:text-ink"
      >
        {label}
        {active === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : active === 'desc' ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}
