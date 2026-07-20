'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { CREDENTIAL_CATEGORIES, credentialCategoryLabel } from '@/lib/credential-categories';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { DashboardDrawer } from '@/components/dashboard/DashboardDrawer';
import { DashboardPagination } from '@/components/dashboard/DashboardPagination';
import { ExportButton } from '@/components/dashboard/ExportButton';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { StrideSelect } from '@/components/ui/stride-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';

type EmployeeOption = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string | null;
  jobTitle: string | null;
};

type CredentialRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  category: string;
  credentialName: string;
  credentialNumber: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  reminderDays: number;
  status: string;
  effectiveStatus: string;
  scopeOfPractice: string | null;
  notes: string | null;
  documentPath: string | null;
  verifiedAt: string | null;
};

type ListResponse = {
  credentials: CredentialRecord[];
  total: number;
  page: number;
  pageSize: number;
};

type SortKey = 'expiry' | 'staff' | 'status';

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'expiring_soon', label: 'Expiring soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'revoked', label: 'Revoked' },
] as const;

const PAGE_SIZE = 25;

const emptyForm = {
  employeeId: '',
  category: 'medical_license',
  credentialName: '',
  credentialNumber: '',
  issuingAuthority: '',
  issueDate: '',
  expiryDate: '',
  reminderDays: '30',
  status: 'active',
  scopeOfPractice: '',
  notes: '',
};

type FormState = typeof emptyForm;

export default function CredentialsPage() {
  return (
    <Suspense fallback={<div className="w-full min-w-0 py-16 text-center text-sm text-neutral-500">Loading credentials…</div>}>
      <CredentialsPageContent />
    </Suspense>
  );
}

function badgeStyle(status: string) {
  if (status === 'expired') return 'bg-red-100 text-red-700 border-red-200';
  if (status === 'expiring_soon') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'suspended' || status === 'revoked') return 'bg-neutral-100 text-neutral-700 border-neutral-300';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${badgeStyle(status)}`}>
      {status === 'expired' ? (
        <ShieldAlert className="h-3 w-3" />
      ) : status === 'expiring_soon' ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <BadgeCheck className="h-3 w-3" />
      )}
      {status.replaceAll('_', ' ')}
    </span>
  );
}

function CredentialsPageContent() {
  const searchParams = useSearchParams();
  const employeeIdFromUrl = searchParams.get('employeeId') || '';
  const statusFromUrl = searchParams.get('status') || '';

  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expiring: 0, expired: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(statusFromUrl);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'expiry', dir: 'asc' });

  // Add / edit modal.
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Detail drawer + confirm + inline actions.
  const [detail, setDetail] = useState<CredentialRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CredentialRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (statusFromUrl) setStatusFilter(statusFromUrl);
  }, [statusFromUrl]);

  // Debounce search input.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to first page whenever the query changes.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter, sort.key, sort.dir]);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    params.set('sort', sort.key);
    params.set('dir', sort.dir);
    if (search) params.set('q', search);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (employeeIdFromUrl) params.set('employeeId', employeeIdFromUrl);
    return `/api/credentials?${params.toString()}`;
  }, [page, sort.key, sort.dir, search, statusFilter, categoryFilter, employeeIdFromUrl]);

  const exportBase = useMemo(() => {
    const params = new URLSearchParams();
    params.set('sort', sort.key);
    params.set('dir', sort.dir);
    if (search) params.set('q', search);
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (employeeIdFromUrl) params.set('employeeId', employeeIdFromUrl);
    return params.toString();
  }, [sort.key, sort.dir, search, statusFilter, categoryFilter, employeeIdFromUrl]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(listUrl, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as Partial<ListResponse> & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load credentials');
      setCredentials(Array.isArray(data.credentials) ? data.credentials : []);
      setTotal(typeof data.total === 'number' ? data.total : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  const loadMeta = useCallback(async () => {
    const scope = employeeIdFromUrl ? `employeeId=${encodeURIComponent(employeeIdFromUrl)}&` : '';
    const countUrl = (status?: string) =>
      `/api/credentials?${scope}pageSize=1&page=1${status ? `&status=${status}` : ''}`;
    try {
      const [employeesRes, totalRes, activeRes, expiringRes, expiredRes] = await Promise.all([
        fetch('/api/outsourcing/employees', { cache: 'no-store' }),
        fetch(countUrl(), { cache: 'no-store' }),
        fetch(countUrl('active'), { cache: 'no-store' }),
        fetch(countUrl('expiring_soon'), { cache: 'no-store' }),
        fetch(countUrl('expired'), { cache: 'no-store' }),
      ]);
      const employeesData = await employeesRes.json().catch(() => []);
      if (employeesRes.ok) setEmployees(Array.isArray(employeesData) ? employeesData : []);
      const readTotal = async (r: Response) => {
        const d = (await r.json().catch(() => ({}))) as { total?: number };
        return typeof d.total === 'number' ? d.total : 0;
      };
      setStats({
        total: await readTotal(totalRes),
        active: await readTotal(activeRes),
        expiring: await readTotal(expiringRes),
        expired: await readTotal(expiredRes),
      });
    } catch {
      // Non-fatal: stats/employees are supplementary.
    }
  }, [employeeIdFromUrl]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const listStatus = useMemo(() => {
    if (loading && credentials.length === 0) return 'loading' as const;
    if (error && credentials.length === 0) return 'error' as const;
    if (credentials.length === 0) return 'empty' as const;
    return 'success' as const;
  }, [credentials.length, error, loading]);

  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'Select employee' },
      ...employees.map((e) => ({
        value: e.id,
        label: `${e.firstName} ${e.lastName}${e.employeeNumber ? ` (${e.employeeNumber})` : ''}`,
      })),
    ],
    [employees],
  );

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (record: CredentialRecord) => {
    setEditingId(record.id);
    setForm({
      employeeId: record.employeeId,
      category: record.category,
      credentialName: record.credentialName,
      credentialNumber: record.credentialNumber ?? '',
      issuingAuthority: record.issuingAuthority ?? '',
      issueDate: record.issueDate ?? '',
      expiryDate: record.expiryDate ?? '',
      reminderDays: String(record.reminderDays ?? 30),
      status: record.status,
      scopeOfPractice: record.scopeOfPractice ?? '',
      notes: record.notes ?? '',
    });
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!form.employeeId || !form.credentialName.trim()) {
      toast.error('Employee and credential name are required.');
      return;
    }
    const payload = {
      employeeId: form.employeeId,
      category: form.category,
      credentialName: form.credentialName.trim(),
      credentialNumber: form.credentialNumber.trim() || null,
      issuingAuthority: form.issuingAuthority.trim() || null,
      issueDate: form.issueDate || null,
      expiryDate: form.expiryDate || null,
      reminderDays: Math.max(0, Math.min(365, parseInt(form.reminderDays || '30', 10) || 30)),
      status: form.status,
      scopeOfPractice: form.scopeOfPractice.trim() || null,
      notes: form.notes.trim() || null,
    };
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/credentials/${editingId}` : '/api/credentials', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save credential');
      toast.success(editingId ? 'Credential updated' : 'Credential added');
      setFormOpen(false);
      if (editingId && detail?.id === editingId) setDetail(data as CredentialRecord);
      await Promise.all([loadList(), loadMeta()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/credentials/${deleteTarget.id}`, { method: 'DELETE', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete credential');
      toast.success('Credential deleted');
      if (detail?.id === deleteTarget.id) setDetail(null);
      setDeleteTarget(null);
      await Promise.all([loadList(), loadMeta()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete credential');
    } finally {
      setDeleting(false);
    }
  };

  const verifyCredential = async (record: CredentialRecord, verify: boolean) => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/credentials/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verify }),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update verification');
      toast.success(verify ? 'Credential verified' : 'Verification cleared');
      setDetail(data as CredentialRecord);
      await loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update verification');
    } finally {
      setVerifying(false);
    }
  };

  const uploadDocument = async (record: CredentialRecord, file: File) => {
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/credentials/${record.id}/document`, {
        method: 'POST',
        body: fd,
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to upload document');
      toast.success('Document uploaded');
      setDetail(data as CredentialRecord);
      await loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const removeDocument = async (record: CredentialRecord) => {
    setUploadingDoc(true);
    try {
      const res = await fetch(`/api/credentials/${record.id}/document`, { method: 'DELETE', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove document');
      toast.success('Document removed');
      setDetail(data as CredentialRecord);
      await loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove document');
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Credentials & licences"
        icon={BadgeCheck}
        description="Track workforce credentials, licences, and expiry reminders."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              options={[
                { format: 'csv', label: 'Export CSV', href: `/api/credentials/export?format=csv&${exportBase}` },
                { format: 'xlsx', label: 'Export Excel', href: `/api/credentials/export?format=xlsx&${exportBase}` },
                { format: 'pdf', label: 'Export PDF', href: `/api/credentials/export?format=pdf&${exportBase}` },
              ]}
            />
            <button type="button" onClick={openCreate} className="btn-primary inline-flex shrink-0 items-center gap-2">
              <Plus className="h-4 w-4" />
              Add credential
            </button>
          </div>
        }
      />

      <DashboardStatGrid>
        <DashboardStatCard label="Total" value={stats.total} tone="primary" />
        <DashboardStatCard label="Active" value={stats.active} tone="success" />
        <DashboardStatCard label="Expiring soon" value={stats.expiring} tone="warning" warn={stats.expiring > 0} />
        <DashboardStatCard label="Expired" value={stats.expired} tone="violet" warn={stats.expired > 0} />
      </DashboardStatGrid>

      <DashboardTableCard>
        <DashboardTableToolbar label={null}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <DashboardTableSearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search staff, credential, number or authority…"
              />
            </div>
            <StrideSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: '', label: 'All categories' },
                ...CREDENTIAL_CATEGORIES.map((opt) => ({ value: opt.value, label: opt.label })),
              ]}
              ariaLabel="Filter by category"
            />
            <StrideSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: 'All statuses' },
                ...STATUSES.map((opt) => ({ value: opt.value, label: opt.label })),
              ]}
              ariaLabel="Filter by status"
            />
          </div>
        </DashboardTableToolbar>

        <DashboardAsyncState
          status={listStatus}
          error={credentials.length === 0 ? error : null}
          onRetry={() => void loadList()}
          empty={
            <DashboardTableEmpty
              icon={<BadgeCheck className="h-8 w-8 text-neutral-300" aria-hidden />}
              title="No credentials found"
              description="No credentials match the current filters."
            />
          }
        >
          <DashboardTableViewport minWidth={980}>
            <DashboardTable>
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <SortHeader label="Staff" sortKey="staff" sort={sort} onSort={toggleSort} />
                  <th className="px-3 py-2">Credential</th>
                  <th className="px-3 py-2">Authority</th>
                  <th className="px-3 py-2 col-center">Issue</th>
                  <SortHeader label="Expiry" sortKey="expiry" sort={sort} onSort={toggleSort} className="col-center" />
                  <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} className="col-center" />
                  <th className="px-3 py-2 col-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-sm">
                {credentials.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer hover:bg-neutral-50/60"
                    onClick={() => setDetail(item)}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 font-medium text-neutral-800">
                        {item.employeeName}
                        {item.verifiedAt ? (
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-label="Verified" />
                        ) : null}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {item.jobTitle ?? 'No role'} {item.employeeNumber ? `· ${item.employeeNumber}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 font-medium text-neutral-800">
                        {item.credentialName}
                        {item.documentPath ? (
                          <FileText className="h-3.5 w-3.5 text-neutral-400" aria-label="Has document" />
                        ) : null}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {item.credentialNumber ?? 'No number'} · {credentialCategoryLabel(item.category)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">{item.issuingAuthority ?? '—'}</td>
                    <td className="px-3 py-2 col-center tabular-nums">{item.issueDate ?? '—'}</td>
                    <td className="px-3 py-2 col-center tabular-nums">{item.expiryDate ?? '—'}</td>
                    <td className="px-3 py-2 col-center">
                      <StatusBadge status={item.effectiveStatus} />
                    </td>
                    <td className="px-3 py-2 col-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(item)}
                        className="mr-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        </DashboardAsyncState>

        {total > 0 ? (
          <DashboardPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            itemLabel="credentials"
          />
        ) : null}
      </DashboardTableCard>

      {/* Add / edit modal */}
      <DashboardModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit credential' : 'Add credential'}
        icon={<BadgeCheck className="h-5 w-5" />}
        size="lg"
        dismissible={!saving}
        footer={
          <>
            <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitForm}
              disabled={saving}
              className="btn-primary inline-flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? 'Save changes' : 'Add credential'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-neutral-600">Employee *</span>
            <StrideSelect
              value={form.employeeId}
              onChange={(value) => setForm((f) => ({ ...f, employeeId: value }))}
              options={employeeOptions}
              ariaLabel="Employee"
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Category</span>
            <StrideSelect
              value={form.category}
              onChange={(value) => setForm((f) => ({ ...f, category: value }))}
              options={CREDENTIAL_CATEGORIES.map((opt) => ({ value: opt.value, label: opt.label }))}
              ariaLabel="Category"
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-neutral-600">Status</span>
            <StrideSelect
              value={form.status}
              onChange={(value) => setForm((f) => ({ ...f, status: value }))}
              options={STATUSES.map((opt) => ({ value: opt.value, label: opt.label }))}
              ariaLabel="Status"
              className="mt-1 w-full"
            />
          </label>
          <TextField
            label="Credential name *"
            value={form.credentialName}
            onChange={(v) => setForm((f) => ({ ...f, credentialName: v }))}
          />
          <TextField
            label="License / cert number"
            value={form.credentialNumber}
            onChange={(v) => setForm((f) => ({ ...f, credentialNumber: v }))}
          />
          <TextField
            label="Issuing authority"
            value={form.issuingAuthority}
            onChange={(v) => setForm((f) => ({ ...f, issuingAuthority: v }))}
          />
          <TextField
            label="Reminder (days)"
            type="number"
            value={form.reminderDays}
            onChange={(v) => setForm((f) => ({ ...f, reminderDays: v }))}
          />
          <TextField
            label="Issue date"
            type="date"
            value={form.issueDate}
            onChange={(v) => setForm((f) => ({ ...f, issueDate: v }))}
          />
          <TextField
            label="Expiry date"
            type="date"
            value={form.expiryDate}
            onChange={(v) => setForm((f) => ({ ...f, expiryDate: v }))}
          />
          <TextField
            className="sm:col-span-2"
            label="Scope / site or practice area"
            value={form.scopeOfPractice}
            onChange={(v) => setForm((f) => ({ ...f, scopeOfPractice: v }))}
          />
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-neutral-600">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </DashboardModal>

      {/* Detail drawer */}
      <DashboardDrawer
        open={detail !== null}
        onClose={() => setDetail(null)}
        eyebrow={detail ? credentialCategoryLabel(detail.category) : undefined}
        title={detail?.credentialName ?? 'Credential'}
        icon={<BadgeCheck className="h-5 w-5" />}
        headerAside={detail ? <StatusBadge status={detail.effectiveStatus} /> : undefined}
        width="lg"
        footer={
          detail ? (
            <>
              <button
                type="button"
                onClick={() => setDeleteTarget(detail)}
                className="btn-secondary inline-flex items-center gap-2 text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button type="button" onClick={() => openEdit(detail)} className="btn-primary inline-flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            </>
          ) : undefined
        }
      >
        {detail ? (
          <div className="space-y-5">
            <section className="rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                  <ShieldCheck className={`h-4 w-4 ${detail.verifiedAt ? 'text-emerald-600' : 'text-neutral-400'}`} />
                  Verification
                </div>
                {detail.verifiedAt ? (
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => verifyCredential(detail, false)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
                  >
                    {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Mark unverified
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={verifying}
                    onClick={() => verifyCredential(detail, true)}
                    className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    Verify
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {detail.verifiedAt
                  ? `Verified on ${new Date(detail.verifiedAt).toLocaleString()}`
                  : 'This credential has not been verified yet.'}
              </p>
            </section>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <DetailRow label="Staff" value={detail.employeeName} />
              <DetailRow label="Employee no." value={detail.employeeNumber ?? '—'} />
              <DetailRow label="Role" value={detail.jobTitle ?? '—'} />
              <DetailRow label="Department" value={detail.departmentName ?? '—'} />
              <DetailRow label="Credential number" value={detail.credentialNumber ?? '—'} />
              <DetailRow label="Issuing authority" value={detail.issuingAuthority ?? '—'} />
              <DetailRow label="Issue date" value={detail.issueDate ?? '—'} />
              <DetailRow label="Expiry date" value={detail.expiryDate ?? '—'} />
              <DetailRow label="Reminder" value={`${detail.reminderDays} days`} />
              <DetailRow label="Category" value={credentialCategoryLabel(detail.category)} />
              <DetailRow className="col-span-2" label="Scope of practice" value={detail.scopeOfPractice ?? '—'} />
              <DetailRow className="col-span-2" label="Notes" value={detail.notes ?? '—'} />
            </dl>

            <section className="rounded-lg border border-neutral-200 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <FileText className="h-4 w-4" />
                Supporting document
              </div>
              {detail.documentPath ? (
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={detail.documentPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary inline-flex items-center gap-2 text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Preview / download
                  </a>
                  <button
                    type="button"
                    disabled={uploadingDoc}
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary inline-flex items-center gap-2 text-sm"
                  >
                    {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Replace
                  </button>
                  <button
                    type="button"
                    disabled={uploadingDoc}
                    onClick={() => removeDocument(detail)}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploadingDoc}
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary inline-flex items-center gap-2 text-sm"
                >
                  {uploadingDoc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload PDF
                </button>
              )}
              <p className="mt-2 text-xs text-neutral-500">PDF only, up to 4.5MB.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && detail) void uploadDocument(detail, file);
                  e.target.value = '';
                }}
              />
            </section>
          </div>
        ) : null}
      </DashboardDrawer>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this credential record?"
        description={
          deleteTarget
            ? `${deleteTarget.credentialName} for ${deleteTarget.employeeName} will be permanently removed.`
            : undefined
        }
        tone="danger"
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </DashboardPage>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th className={`px-3 py-2 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-neutral-800"
      >
        {label}
        {active ? (
          sort.dir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-neutral-800">{value}</dd>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <input
        type={type}
        min={type === 'number' ? 0 : undefined}
        max={type === 'number' ? 365 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
      />
    </label>
  );
}
