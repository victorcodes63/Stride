'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone,
  Plus,
  Pin,
  PinOff,
  Send,
  Archive,
  Pencil,
  Trash2,
  Eye,
  CheckCircle2,
  Paperclip,
  Users,
  Clock,
  Upload,
  X,
  FileText,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTabs, type DashboardTabItem } from '@/components/dashboard/DashboardTabs';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { DashboardDrawer } from '@/components/dashboard/DashboardDrawer';
import { DashboardPagination } from '@/components/dashboard/DashboardPagination';
import { ExportButton } from '@/components/dashboard/ExportButton';
import { DashboardStatGrid, DashboardStatCard } from '@/components/dashboard/DashboardStatGrid';
import { DashboardAsyncState, DashboardEmptyState } from '@/components/dashboard/DashboardAsyncState';
import { StrideSelect } from '@/components/ui/stride-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';
import { sanitizeJobContent } from '@/lib/sanitize-html';
import { useApiResource, useApiMutation, apiFetch, ApiError } from '@/hooks/useApiResource';
import { AnnouncementEditor } from './AnnouncementEditor';

const PAGE_SIZE = 20;

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  status: 'draft' | 'published' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  authorUserId: string;
  publishedAt: string | null;
  expiresAt: string | null;
  isPinned: boolean;
  requireAcknowledgement: boolean;
  targetDepartments: string[] | null;
  targetRoles: string[] | null;
  readCount: number;
  ackCount: number;
  attachmentCount: number;
  createdAt: string;
};

type ListResponse = {
  announcements: AnnouncementRow[];
  total: number;
  page: number;
  pageSize: number;
};

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSize: number | null;
  createdAt: string;
};

type ReadEntry = {
  id: string;
  userId: string | null;
  employeeId: string | null;
  name: string | null;
  email: string | null;
  readAt: string;
  acknowledgedAt: string | null;
};

type DetailResponse = {
  announcement: AnnouncementRow & {
    updatedAt: string;
    attachments: Attachment[];
  };
  engagement: {
    readCount: number;
    ackCount: number;
    reads: ReadEntry[];
  };
};

type Department = { id: string; name: string; employeeCount?: number };

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admins' },
  { value: 'staff', label: 'Staff' },
  { value: 'viewer', label: 'Viewers' },
];

const PRIORITY_TONE: Record<AnnouncementRow['priority'], DashStatusTone> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

const STATUS_TONE: Record<AnnouncementRow['status'], DashStatusTone> = {
  draft: 'neutral',
  published: 'success',
  archived: 'neutral',
};

type FormState = {
  title: string;
  body: string;
  priority: AnnouncementRow['priority'];
  status: 'draft' | 'published';
  isPinned: boolean;
  requireAcknowledgement: boolean;
  expiresAt: string;
  targetDepartments: string[];
  targetRoles: string[];
};

const EMPTY_FORM: FormState = {
  title: '',
  body: '',
  priority: 'normal',
  status: 'published',
  isPinned: false,
  requireAcknowledgement: false,
  expiresAt: '',
  targetDepartments: [],
  targetRoles: [],
};

function fmtDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function toDateInput(value: string | null): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function fmtBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AnnouncementsContent() {
  const [status, setStatus] = useState<'' | AnnouncementRow['status']>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const listUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (search) p.set('search', search);
    p.set('page', String(page));
    p.set('pageSize', String(PAGE_SIZE));
    return `/api/announcements?${p.toString()}`;
  }, [status, search, page]);

  const listKey = useMemo(() => ['announcements', status, search, page] as const, [status, search, page]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useApiResource<ListResponse>(listKey, listUrl, { placeholderData: (prev) => prev });

  const departmentsQuery = useApiResource<Department[]>(['payroll-departments'], '/api/payroll/departments', {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const departments = departmentsQuery.data ?? [];

  const announcements = data?.announcements ?? [];
  const total = data?.total ?? 0;

  const invalidate = [['announcements'] as const];

  const createMutation = useApiMutation<{ id: string }, FormState>(
    (values) =>
      apiFetch('/api/announcements', {
        method: 'POST',
        body: JSON.stringify(serializeForm(values)),
      }),
    {
      invalidateKeys: invalidate,
      onSuccess: () => {
        toast.success('Announcement created.');
        closeForm();
      },
      onError: (e) => toast.error(e.message),
    },
  );

  const updateMutation = useApiMutation<{ id: string }, { id: string; values: Partial<FormState> }>(
    ({ id, values }) =>
      apiFetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(serializeForm(values)),
      }),
    {
      invalidateKeys: invalidate,
      onSuccess: () => {
        toast.success('Announcement updated.');
        closeForm();
      },
      onError: (e) => toast.error(e.message),
    },
  );

  const quickMutation = useApiMutation<
    { id: string },
    { id: string; patch: Record<string, unknown>; label: string }
  >(
    ({ id, patch }) =>
      apiFetch(`/api/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    {
      invalidateKeys: invalidate,
      onSuccess: (_d, vars) => toast.success(vars.label),
      onError: (e) => toast.error(e.message),
    },
  );

  const deleteMutation = useApiMutation<{ ok: boolean }, string>(
    (id) => apiFetch(`/api/announcements/${id}`, { method: 'DELETE' }),
    {
      invalidateKeys: invalidate,
      onSuccess: () => {
        toast.success('Announcement deleted.');
        setDeleteTarget(null);
        if (detailId === deleteTarget?.id) setDetailId(null);
      },
      onError: (e) => toast.error(e.message),
    },
  );

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (a: AnnouncementRow) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      body: a.body,
      priority: a.priority,
      status: a.status === 'archived' ? 'draft' : a.status,
      isPinned: a.isPinned,
      requireAcknowledgement: a.requireAcknowledgement,
      expiresAt: toDateInput(a.expiresAt),
      targetDepartments: a.targetDepartments ?? [],
      targetRoles: a.targetRoles ?? [],
    });
    setFormOpen(true);
  };

  const submitForm = () => {
    if (!form.title.trim() || !stripToText(form.body)) {
      toast.error('Title and body are required.');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, values: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const stats = useMemo(() => {
    const totalReads = announcements.reduce((sum, a) => sum + a.readCount, 0);
    const totalAcks = announcements.reduce((sum, a) => sum + a.ackCount, 0);
    const published = announcements.filter((a) => a.status === 'published').length;
    return { totalReads, totalAcks, published };
  }, [announcements]);

  const tabs: DashboardTabItem<'' | AnnouncementRow['status']>[] = [
    { value: '', label: 'All' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Drafts' },
    { value: 'archived', label: 'Archived' },
  ];

  const asyncStatus = isLoading
    ? 'loading'
    : isError
      ? 'error'
      : announcements.length === 0
        ? 'empty'
        : 'success';

  const busy = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Announcements"
        icon={Megaphone}
        description="Broadcast company-wide notices, track reach, and require acknowledgements."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              options={[
                { format: 'csv', label: 'Export CSV', href: buildExportUrl('csv', status, search) },
                { format: 'xlsx', label: 'Export Excel', href: buildExportUrl('xlsx', status, search) },
              ]}
            />
            <button
              type="button"
              onClick={openCreate}
              className="btn-primary inline-flex shrink-0 items-center gap-2"
            >
              <Plus className="h-4 w-4" /> New announcement
            </button>
          </div>
        }
      />

      <DashboardStatGrid columns={4}>
        <DashboardStatCard label="On this page" value={announcements.length} tone="primary" />
        <DashboardStatCard label="Published" value={stats.published} tone="success" />
        <DashboardStatCard label="Total reads" value={stats.totalReads} tone="sky" />
        <DashboardStatCard label="Acknowledged" value={stats.totalAcks} tone="violet" />
      </DashboardStatGrid>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DashboardTabs
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          items={tabs}
        />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search announcements…"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:max-w-xs"
        />
      </div>

      <DashboardAsyncState
        status={asyncStatus}
        error={error instanceof ApiError ? error.message : error ? String(error) : null}
        onRetry={() => refetch()}
        empty={
          <DashboardEmptyState
            icon={Megaphone}
            title="No announcements"
            description={
              search || status
                ? 'No announcements match your filters.'
                : 'Create your first announcement to keep your team informed.'
            }
            action={
              <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
                <Plus className="h-4 w-4" /> New announcement
              </button>
            }
          />
        }
      >
        <div className="space-y-3">
          {announcements.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              onView={() => setDetailId(a.id)}
              onEdit={() => openEdit(a)}
              onDelete={() => setDeleteTarget(a)}
              onTogglePin={() =>
                quickMutation.mutate({
                  id: a.id,
                  patch: { isPinned: !a.isPinned },
                  label: a.isPinned ? 'Unpinned.' : 'Pinned to top.',
                })
              }
              onPublish={() =>
                quickMutation.mutate({ id: a.id, patch: { status: 'published' }, label: 'Published.' })
              }
              onArchive={() =>
                quickMutation.mutate({ id: a.id, patch: { status: 'archived' }, label: 'Archived.' })
              }
              busy={quickMutation.isPending}
            />
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-[var(--dash-border)]">
          <DashboardPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            itemLabel="announcements"
          />
        </div>
      </DashboardAsyncState>

      <AnnouncementFormModal
        open={formOpen}
        editing={Boolean(editingId)}
        form={form}
        setForm={setForm}
        departments={departments}
        busy={busy}
        onClose={closeForm}
        onSubmit={submitForm}
      />

      <AnnouncementDetailDrawer
        id={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(a) => {
          setDetailId(null);
          openEdit(a);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete announcement"
        description={
          deleteTarget ? (
            <>
              Delete <span className="font-medium">{deleteTarget.title}</span>? This also removes its
              attachments and read receipts. This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </DashboardPage>
  );
}

function serializeForm(values: Partial<FormState>) {
  return {
    ...(values.title !== undefined ? { title: values.title } : {}),
    ...(values.body !== undefined ? { body: values.body } : {}),
    ...(values.priority !== undefined ? { priority: values.priority } : {}),
    ...(values.status !== undefined ? { status: values.status } : {}),
    ...(values.isPinned !== undefined ? { isPinned: values.isPinned } : {}),
    ...(values.requireAcknowledgement !== undefined
      ? { requireAcknowledgement: values.requireAcknowledgement }
      : {}),
    ...(values.expiresAt !== undefined ? { expiresAt: values.expiresAt || null } : {}),
    ...(values.targetDepartments !== undefined
      ? { targetDepartments: values.targetDepartments.length ? values.targetDepartments : null }
      : {}),
    ...(values.targetRoles !== undefined
      ? { targetRoles: values.targetRoles.length ? values.targetRoles : null }
      : {}),
  };
}

function stripToText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function buildExportUrl(format: 'csv' | 'xlsx', status: string, search: string): string {
  const p = new URLSearchParams();
  p.set('format', format);
  if (status) p.set('status', status);
  if (search) p.set('search', search);
  return `/api/announcements/export?${p.toString()}`;
}

function AnnouncementCard({
  announcement: a,
  onView,
  onEdit,
  onDelete,
  onTogglePin,
  onPublish,
  onArchive,
  busy,
}: {
  announcement: AnnouncementRow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onPublish: () => void;
  onArchive: () => void;
  busy: boolean;
}) {
  return (
    <div
      className={`dashboard-surface p-5 transition-colors ${
        a.isPinned ? 'border-primary-200 bg-primary-50/20' : 'border-neutral-200 hover:border-neutral-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100">
          {a.isPinned ? (
            <Pin className="h-5 w-5 text-primary-700" />
          ) : (
            <Megaphone className="h-5 w-5 text-primary-700" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onView}
              className="truncate text-left font-bold text-primary-900 hover:underline"
            >
              {a.title}
            </button>
            <span className={dashStatusChip(PRIORITY_TONE[a.priority])}>{a.priority}</span>
            <span className={dashStatusChip(STATUS_TONE[a.status])}>{a.status}</span>
            {a.requireAcknowledgement ? (
              <span className={dashStatusChip('warning')}>ack required</span>
            ) : null}
          </div>
          <div
            className="line-clamp-2 text-sm text-neutral-600 [&_*]:inline [&_*]:text-sm"
            dangerouslySetInnerHTML={{ __html: sanitizeJobContent(a.body) }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
            <span>
              {a.publishedAt ? `Published ${fmtDate(a.publishedAt)}` : `Created ${fmtDate(a.createdAt)}`}
            </span>
            {a.expiresAt ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> Expires {fmtDate(a.expiresAt)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> {a.readCount} read
            </span>
            {a.requireAcknowledgement ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {a.ackCount} ack
              </span>
            ) : null}
            {a.attachmentCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3 w-3" /> {a.attachmentCount}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1">
            <IconAction title="View" onClick={onView} icon={Eye} />
            <IconAction title="Edit" onClick={onEdit} icon={Pencil} />
            <IconAction
              title={a.isPinned ? 'Unpin' : 'Pin'}
              onClick={onTogglePin}
              icon={a.isPinned ? PinOff : Pin}
              disabled={busy}
            />
            <IconAction title="Delete" onClick={onDelete} icon={Trash2} tone="danger" />
          </div>
          <div className="flex items-center gap-1">
            {a.status !== 'published' ? (
              <button
                type="button"
                onClick={onPublish}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg bg-primary-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-800 disabled:opacity-50"
              >
                <Send className="h-3 w-3" /> Publish
              </button>
            ) : null}
            {a.status !== 'archived' ? (
              <button
                type="button"
                onClick={onArchive}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                <Archive className="h-3 w-3" /> Archive
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconAction({
  title,
  onClick,
  icon: Icon,
  tone = 'default',
  disabled,
}: {
  title: string;
  onClick: () => void;
  icon: typeof Eye;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-40 ${
        tone === 'danger'
          ? 'border-neutral-200 text-neutral-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function MultiSelectChips({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
  emptyHint,
}: {
  label: string;
  icon: typeof Users;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyHint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </label>
      {options.length === 0 ? (
        <p className="text-xs text-neutral-400">{emptyHint ?? 'No options available.'}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const active = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggle(opt.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-primary-300 bg-primary-100 text-primary-800'
                    : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnnouncementFormModal({
  open,
  editing,
  form,
  setForm,
  departments,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: boolean;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  departments: Department[];
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const toggleIn = (key: 'targetDepartments' | 'targetRoles', value: string) => {
    setForm((prev) => {
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });
  };

  return (
    <DashboardModal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit announcement' : 'New announcement'}
      description="Compose a rich-text notice and control who sees it."
      icon={<Megaphone className="h-5 w-5" />}
      size="xl"
      dismissible={!busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            {busy ? 'Saving…' : editing ? 'Save changes' : form.status === 'draft' ? 'Save draft' : 'Publish'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Title
          </label>
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="Announcement title"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Body
          </label>
          <AnnouncementEditor
            value={form.body}
            onChange={(html) => setForm((p) => ({ ...p, body: html }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Priority
            </label>
            <StrideSelect
              value={form.priority}
              onChange={(value) => setForm((p) => ({ ...p, priority: value as FormState['priority'] }))}
              options={[
                { value: 'low', label: 'Low priority' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High priority' },
                { value: 'urgent', label: 'Urgent' },
              ]}
              ariaLabel="Priority"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Publishing
            </label>
            <StrideSelect
              value={form.status}
              onChange={(value) => setForm((p) => ({ ...p, status: value as FormState['status'] }))}
              options={[
                { value: 'published', label: 'Publish now' },
                { value: 'draft', label: 'Save as draft' },
              ]}
              ariaLabel="Publishing"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Expiry date
            </label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
          </div>
          <div className="flex flex-col justify-center gap-2 pt-4">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.isPinned}
                onChange={(e) => setForm((p) => ({ ...p, isPinned: e.target.checked }))}
                className="rounded border-neutral-300"
              />
              Pin to top
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.requireAcknowledgement}
                onChange={(e) => setForm((p) => ({ ...p, requireAcknowledgement: e.target.checked }))}
                className="rounded border-neutral-300"
              />
              Require acknowledgement
            </label>
          </div>
        </div>

        <div className="grid gap-4 border-t border-neutral-100 pt-4 sm:grid-cols-2">
          <MultiSelectChips
            label="Target departments"
            icon={Users}
            options={departments.map((d) => ({ value: d.name, label: d.name }))}
            selected={form.targetDepartments}
            onToggle={(v) => toggleIn('targetDepartments', v)}
            emptyHint="No departments available — this will be visible to everyone."
          />
          <MultiSelectChips
            label="Target roles"
            icon={Users}
            options={ROLE_OPTIONS}
            selected={form.targetRoles}
            onToggle={(v) => toggleIn('targetRoles', v)}
          />
        </div>
        <p className="text-xs text-neutral-400">
          Leave targeting empty to make this announcement visible to everyone.
        </p>
      </div>
    </DashboardModal>
  );
}

function AnnouncementDetailDrawer({
  id,
  onClose,
  onEdit,
}: {
  id: string | null;
  onClose: () => void;
  onEdit: (a: DetailResponse['announcement']) => void;
}) {
  const open = Boolean(id);
  const detailKey = useMemo(() => ['announcement', id] as const, [id]);
  const { data, isLoading, isError, error, refetch } = useApiResource<DetailResponse>(
    detailKey,
    id ? `/api/announcements/${id}` : '/api/announcements/none',
    { enabled: open },
  );

  const markedRead = useRef<string | null>(null);
  const readMutation = useApiMutation<unknown, { id: string; acknowledge: boolean }>(
    ({ id, acknowledge }) =>
      apiFetch(`/api/announcements/${id}/read`, {
        method: 'POST',
        body: JSON.stringify({ acknowledge }),
      }),
    { invalidateKeys: [['announcement', id] as const, ['announcements'] as const] },
  );

  useEffect(() => {
    if (open && id && markedRead.current !== id) {
      markedRead.current = id;
      readMutation.mutate({ id, acknowledge: false });
    }
    if (!open) markedRead.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  const a = data?.announcement;
  const engagement = data?.engagement;

  return (
    <DashboardDrawer
      open={open}
      onClose={onClose}
      eyebrow="Announcement"
      title={a?.title ?? 'Loading…'}
      icon={<Megaphone className="h-5 w-5" />}
      width="lg"
      headerAside={
        a ? (
          <div className="flex items-center gap-2">
            <span className={dashStatusChip(STATUS_TONE[a.status])}>{a.status}</span>
            <button
              type="button"
              onClick={() => onEdit(a)}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
        ) : null
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-full animate-pulse rounded bg-neutral-100" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-100" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error instanceof ApiError ? error.message : 'Failed to load announcement.'}
          <button type="button" onClick={() => refetch()} className="ml-2 underline">
            Retry
          </button>
        </div>
      ) : a && engagement ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={dashStatusChip(PRIORITY_TONE[a.priority])}>{a.priority}</span>
            {a.isPinned ? <span className={dashStatusChip('primary')}>pinned</span> : null}
            {a.requireAcknowledgement ? (
              <span className={dashStatusChip('warning')}>acknowledgement required</span>
            ) : null}
            <span className="text-neutral-400">
              {a.publishedAt ? `Published ${fmtDate(a.publishedAt)}` : `Created ${fmtDate(a.createdAt)}`}
            </span>
            {a.expiresAt ? <span className="text-neutral-400">· Expires {fmtDate(a.expiresAt)}</span> : null}
          </div>

          <div
            className="prose prose-sm max-w-none text-neutral-700 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3"
            dangerouslySetInnerHTML={{ __html: sanitizeJobContent(a.body) }}
          />

          {(a.targetDepartments?.length || a.targetRoles?.length) ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 text-xs">
              <p className="mb-1.5 font-semibold uppercase tracking-wide text-neutral-500">Audience</p>
              <div className="flex flex-wrap gap-1.5">
                {(a.targetDepartments ?? []).map((d) => (
                  <span key={`d-${d}`} className="rounded-full bg-white px-2 py-0.5 text-neutral-600 ring-1 ring-neutral-200">
                    {d}
                  </span>
                ))}
                {(a.targetRoles ?? []).map((r) => (
                  <span key={`r-${r}`} className="rounded-full bg-white px-2 py-0.5 capitalize text-neutral-600 ring-1 ring-neutral-200">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {a.requireAcknowledgement && id ? (
            <button
              type="button"
              onClick={() => readMutation.mutate({ id, acknowledge: true })}
              disabled={readMutation.isPending}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              <CheckCircle2 className="h-4 w-4" /> Acknowledge
            </button>
          ) : null}

          <AttachmentsSection announcementId={a.id} attachments={a.attachments} onChanged={() => refetch()} />

          <EngagementSection engagement={engagement} requireAck={a.requireAcknowledgement} />
        </div>
      ) : null}
    </DashboardDrawer>
  );
}

function AttachmentsSection({
  announcementId,
  attachments,
  onChanged,
}: {
  announcementId: string;
  attachments: Attachment[];
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/announcements/${announcementId}/attachments`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed.');
      }
      toast.success('Attachment uploaded.');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (attachmentId: string) => {
    try {
      const res = await fetch(
        `/api/announcements/${announcementId}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Delete failed.');
      }
      toast.success('Attachment removed.');
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <Paperclip className="h-3.5 w-3.5" /> Attachments
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
        >
          <Upload className="h-3 w-3" /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-neutral-400">No attachments.</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-neutral-400" />
              <a
                href={att.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-primary-700 hover:underline"
              >
                {att.fileName}
              </a>
              {att.fileSize ? <span className="text-xs text-neutral-400">{fmtBytes(att.fileSize)}</span> : null}
              <button
                type="button"
                onClick={() => void remove(att.id)}
                title="Remove attachment"
                aria-label="Remove attachment"
                className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EngagementSection({
  engagement,
  requireAck,
}: {
  engagement: DetailResponse['engagement'];
  requireAck: boolean;
}) {
  return (
    <div className="border-t border-neutral-100 pt-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <Eye className="h-3.5 w-3.5" /> Engagement
      </p>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-neutral-200 p-3">
          <p className="text-2xl font-semibold tabular-nums text-primary-900">{engagement.readCount}</p>
          <p className="text-xs text-neutral-500">Reads</p>
        </div>
        {requireAck ? (
          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="text-2xl font-semibold tabular-nums text-emerald-700">{engagement.ackCount}</p>
            <p className="text-xs text-neutral-500">Acknowledged</p>
          </div>
        ) : null}
      </div>
      {engagement.reads.length === 0 ? (
        <p className="text-xs text-neutral-400">No reads recorded yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {engagement.reads.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-700">{r.name || r.email || 'Unknown user'}</p>
                <p className="text-xs text-neutral-400">Read {fmtDate(r.readAt)}</p>
              </div>
              {r.acknowledgedAt ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledged
                </span>
              ) : (
                <span className="text-xs text-neutral-400">Read</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
