'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  Package,
  Paperclip,
  Plus,
  QrCode,
  RotateCcw,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { DashboardDrawer } from '@/components/dashboard/DashboardDrawer';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { StrideSelect } from '@/components/ui/stride-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { assetCategoryLabel, assetStatusLabel } from '@/lib/asset-categories';
import { depreciationMethodLabel } from '@/lib/asset-depreciation';
import {
  ASSET_MAINTENANCE_STATUSES,
  ASSET_MAINTENANCE_TYPES,
  maintenanceStatusLabel,
  maintenanceTypeLabel,
} from '@/lib/asset-maintenance-api';
import { apiFetch, useApiMutation, useApiResource } from '@/hooks/useApiResource';
import {
  assetStatusChipTone,
  formatCurrency,
  formatDate,
  formatDateTime,
  maintenanceStatusTone,
  type AssetAttachmentRecord,
  type AssetHistoryEvent,
  type AssetMaintenanceRecord,
  type AssetRecord,
} from './asset-types';

type TabKey = 'overview' | 'lifecycle' | 'maintenance' | 'attachments';

type Props = {
  asset: AssetRecord | null;
  open: boolean;
  onClose: () => void;
  onAssign: (asset: AssetRecord) => void;
  onReturn: (asset: AssetRecord) => void;
  onAcknowledge: (asset: AssetRecord) => void;
  onEdit: (asset: AssetRecord) => void;
  busy?: boolean;
};

const LIST_KEY = ['assets', 'list'] as const;
const SUMMARY_KEY = ['assets', 'summary'] as const;

export function AssetDetailDrawer({
  asset,
  open,
  onClose,
  onAssign,
  onReturn,
  onAcknowledge,
  onEdit,
  busy,
}: Props) {
  const [tab, setTab] = useState<TabKey>('overview');

  if (!asset) return null;

  const chip = dashStatusChip(assetStatusChipTone(asset.status));

  return (
    <DashboardDrawer
      open={open}
      onClose={onClose}
      eyebrow={assetCategoryLabel(asset.category)}
      title={asset.name}
      description={<span className="font-mono text-xs">{asset.assetTag}</span>}
      icon={<Package className="h-5 w-5" />}
      width="lg"
      headerAside={<span className={chip}>{assetStatusLabel(asset.status)}</span>}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <a
            href={`/api/assets/${asset.id}/label`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <QrCode className="h-4 w-4" />
            Print label
          </a>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => onEdit(asset)}>
              Edit
            </button>
            {asset.status === 'assigned' ? (
              <>
                {asset.needsHandoverAck ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="btn-secondary inline-flex items-center gap-2"
                    onClick={() => onAcknowledge(asset)}
                  >
                    <UserCheck className="h-4 w-4" />
                    Acknowledge
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  className="btn-primary inline-flex items-center gap-2"
                  onClick={() => onReturn(asset)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Return
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="btn-primary inline-flex items-center gap-2"
                onClick={() => onAssign(asset)}
              >
                <UserPlus className="h-4 w-4" />
                Assign
              </button>
            )}
          </div>
        </div>
      }
    >
      <DashboardTabs
        value={tab}
        onChange={(next) => setTab(next as TabKey)}
        items={[
          { value: 'overview', label: 'Overview', icon: FileText },
          { value: 'lifecycle', label: 'Lifecycle', icon: Clock },
          {
            value: 'maintenance',
            label: 'Maintenance',
            icon: ClipboardList,
            badge:
              asset.maintenanceCount > 0 ? (
                <span className="rounded-full bg-primary-100 px-1.5 text-[10px] font-semibold text-primary-800">
                  {asset.maintenanceCount}
                </span>
              ) : undefined,
          },
          {
            value: 'attachments',
            label: 'Files',
            icon: Paperclip,
            badge:
              asset.attachmentCount > 0 ? (
                <span className="rounded-full bg-primary-100 px-1.5 text-[10px] font-semibold text-primary-800">
                  {asset.attachmentCount}
                </span>
              ) : undefined,
          },
        ]}
        className="mb-4"
      />

      {tab === 'overview' ? <OverviewTab asset={asset} /> : null}
      {tab === 'lifecycle' ? <LifecycleTab assetId={asset.id} /> : null}
      {tab === 'maintenance' ? <MaintenanceTab asset={asset} /> : null}
      {tab === 'attachments' ? <AttachmentsTab assetId={asset.id} /> : null}
    </DashboardDrawer>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-[var(--dash-text-strong)]">{value}</dd>
    </div>
  );
}

function OverviewTab({ asset }: { asset: AssetRecord }) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--dash-text-strong)]">Details</h3>
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Serial number" value={asset.serialNumber || '—'} />
          <Field label="Location" value={asset.location || '—'} />
          <Field label="Manufacturer" value={asset.manufacturer || '—'} />
          <Field label="Model" value={asset.model || '—'} />
          <Field label="Purchase date" value={formatDate(asset.purchaseDate)} />
          <Field label="Purchase cost" value={formatCurrency(asset.purchaseCost)} />
          <Field label="Warranty expiry" value={formatDate(asset.warrantyExpiry)} />
          <Field label="Category" value={assetCategoryLabel(asset.category)} />
        </dl>
        {asset.description ? (
          <p className="mt-3 whitespace-pre-line text-sm text-[var(--dash-text)]">{asset.description}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[var(--dash-text-strong)]">Depreciation</h3>
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Method" value={depreciationMethodLabel(asset.depreciationMethod)} />
          <Field
            label="Useful life"
            value={asset.usefulLifeMonths ? `${asset.usefulLifeMonths} months` : '—'}
          />
          <Field label="Salvage value" value={formatCurrency(asset.salvageValue)} />
          <Field
            label="Accumulated depreciation"
            value={formatCurrency(asset.accumulatedDepreciation)}
          />
          <div className="col-span-2 rounded-lg bg-[var(--dash-surface)] p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
              Current book value
            </dt>
            <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--dash-text-strong)]">
              {asset.bookValue != null ? formatCurrency(asset.bookValue) : '—'}
            </dd>
          </div>
        </dl>
      </section>

      {asset.assignedEmployeeName ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--dash-text-strong)]">Assignment</h3>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Assigned to" value={asset.assignedEmployeeName} />
            <Field label="Employee no." value={asset.assignedEmployeeNumber || '—'} />
            <Field label="Job title" value={asset.assignedEmployeeJobTitle || '—'} />
            <Field label="Department" value={asset.assignedEmployeeDepartment || '—'} />
            <Field label="Assigned on" value={formatDateTime(asset.assignedAt)} />
            <Field label="Assigned by" value={asset.assignedByUserName || '—'} />
            <Field
              label="Handover"
              value={
                asset.handoverAcknowledgedAt ? (
                  <span className="text-emerald-700">
                    Acknowledged {formatDateTime(asset.handoverAcknowledgedAt)}
                  </span>
                ) : asset.needsHandoverAck ? (
                  <span className="font-medium text-amber-700">Pending acknowledgement</span>
                ) : (
                  '—'
                )
              }
            />
          </dl>
          {asset.handoverNotes ? (
            <p className="mt-3 whitespace-pre-line rounded-lg bg-[var(--dash-surface-muted)] p-3 text-sm text-[var(--dash-text)]">
              {asset.handoverNotes}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function LifecycleTab({ assetId }: { assetId: string }) {
  const query = useApiResource<{ events: AssetHistoryEvent[] }>(
    ['assets', 'history', assetId],
    `/api/assets/${assetId}/history`,
  );
  const events = query.data?.events ?? [];
  const status = query.isLoading ? 'loading' : query.isError ? 'error' : events.length === 0 ? 'empty' : 'success';

  return (
    <DashboardAsyncState
      status={status}
      error={query.error?.message}
      onRetry={() => void query.refetch()}
      empty={<p className="py-8 text-center text-sm text-[var(--dash-text-muted)]">No lifecycle events yet.</p>}
    >
      <ol className="space-y-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium capitalize text-[var(--dash-text-strong)]">
                {event.eventType.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-[var(--dash-text-muted)]">{formatDateTime(event.createdAt)}</span>
            </div>
            {event.employeeLabel ? (
              <p className="mt-1 text-[var(--dash-text)]">Employee: {event.employeeLabel}</p>
            ) : null}
            {event.fromEmployeeLabel ? (
              <p className="mt-1 text-[var(--dash-text)]">From: {event.fromEmployeeLabel}</p>
            ) : null}
            {event.fromStatus || event.toStatus ? (
              <p className="mt-1 text-[var(--dash-text-muted)]">
                {event.fromStatus ? `${event.fromStatus} → ` : ''}
                {event.toStatus ?? ''}
              </p>
            ) : null}
            {event.performedByUserName ? (
              <p className="mt-1 text-xs text-[var(--dash-text-muted)]">By {event.performedByUserName}</p>
            ) : null}
            {event.notes ? <p className="mt-1 text-xs text-[var(--dash-text-muted)]">{event.notes}</p> : null}
          </li>
        ))}
      </ol>
    </DashboardAsyncState>
  );
}

const emptyMaintenanceForm = {
  title: '',
  type: 'preventive',
  status: 'scheduled',
  scheduledFor: '',
  nextDueAt: '',
  vendor: '',
  cost: '',
  description: '',
};

function MaintenanceTab({ asset }: { asset: AssetRecord }) {
  const assetId = asset.id;
  const query = useApiResource<{ items: AssetMaintenanceRecord[] }>(
    ['assets', 'maintenance', assetId],
    `/api/assets/${assetId}/maintenance`,
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyMaintenanceForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const invalidateKeys = [['assets', 'maintenance', assetId], LIST_KEY, SUMMARY_KEY];

  const createMutation = useApiMutation(
    (payload: Record<string, unknown>) =>
      apiFetch(`/api/assets/${assetId}/maintenance`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    {
      invalidateKeys,
      onSuccess: () => {
        toast.success('Maintenance scheduled');
        setShowForm(false);
        setForm(emptyMaintenanceForm);
      },
      onError: (e) => toast.error(e.message),
    },
  );

  const completeMutation = useApiMutation(
    (id: string) =>
      apiFetch(`/api/assets/${assetId}/maintenance/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      }),
    {
      invalidateKeys,
      onSuccess: () => toast.success('Marked complete'),
      onError: (e) => toast.error(e.message),
    },
  );

  const deleteMutation = useApiMutation(
    (id: string) => apiFetch(`/api/assets/${assetId}/maintenance/${id}`, { method: 'DELETE' }),
    {
      invalidateKeys,
      onSuccess: () => {
        toast.success('Maintenance removed');
        setConfirmDelete(null);
      },
      onError: (e) => toast.error(e.message),
    },
  );

  const items = query.data?.items ?? [];
  const status = query.isLoading ? 'loading' : query.isError ? 'error' : items.length === 0 ? 'empty' : 'success';

  const submit = () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    createMutation.mutate({
      title: form.title.trim(),
      type: form.type,
      status: form.status,
      scheduledFor: form.scheduledFor || null,
      nextDueAt: form.nextDueAt || null,
      vendor: form.vendor || null,
      cost: form.cost ? Number(form.cost) : null,
      description: form.description || null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--dash-text-muted)]">
          {asset.nextMaintenanceAt ? `Next due ${formatDate(asset.nextMaintenanceAt)}` : 'No upcoming maintenance'}
        </p>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-4 w-4" />
          Schedule
        </button>
      </div>

      {showForm ? (
        <div className="space-y-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
          <label className="block">
            <span className="text-xs font-medium text-[var(--dash-text-muted)]">Title *</span>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
              placeholder="Annual service"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-muted)]">Type</span>
              <StrideSelect
                value={form.type}
                onChange={(v) => setForm((f) => ({ ...f, type: v }))}
                options={ASSET_MAINTENANCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                ariaLabel="Type"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-muted)]">Status</span>
              <StrideSelect
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                options={ASSET_MAINTENANCE_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                ariaLabel="Status"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-muted)]">Scheduled for</span>
              <input
                type="date"
                value={form.scheduledFor}
                onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-muted)]">Next due</span>
              <input
                type="date"
                value={form.nextDueAt}
                onChange={(e) => setForm((f) => ({ ...f, nextDueAt: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-muted)]">Vendor</span>
              <input
                value={form.vendor}
                onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-[var(--dash-text-muted)]">Cost (KES)</span>
              <input
                type="number"
                min="0"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                className="mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-[var(--dash-text-muted)]">Notes</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              disabled={createMutation.isPending}
              onClick={submit}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      ) : null}

      <DashboardAsyncState
        status={status}
        error={query.error?.message}
        onRetry={() => void query.refetch()}
        empty={<p className="py-8 text-center text-sm text-[var(--dash-text-muted)]">No maintenance records yet.</p>}
      >
        <ul className="space-y-3">
          {items.map((record) => (
            <li key={record.id} className="rounded-lg border border-[var(--dash-border)] p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--dash-text-strong)]">{record.title}</p>
                  <p className="text-xs text-[var(--dash-text-muted)]">
                    {maintenanceTypeLabel(record.type)}
                    {record.vendor ? ` · ${record.vendor}` : ''}
                    {record.cost != null ? ` · ${formatCurrency(record.cost)}` : ''}
                  </p>
                </div>
                <span className={dashStatusChip(maintenanceStatusTone(record.status))}>
                  {maintenanceStatusLabel(record.status)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-muted)]">
                {record.scheduledFor ? <span>Scheduled {formatDate(record.scheduledFor)}</span> : null}
                {record.completedAt ? <span>Completed {formatDate(record.completedAt)}</span> : null}
                {record.nextDueAt ? <span>Next due {formatDate(record.nextDueAt)}</span> : null}
              </div>
              {record.description ? (
                <p className="mt-1 text-xs text-[var(--dash-text)]">{record.description}</p>
              ) : null}
              <div className="mt-2 flex justify-end gap-2">
                {record.status !== 'completed' && record.status !== 'cancelled' ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary-700 hover:underline disabled:opacity-50"
                    disabled={completeMutation.isPending}
                    onClick={() => completeMutation.mutate(record.id)}
                  >
                    Mark complete
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs font-medium text-red-600 hover:underline"
                  onClick={() => setConfirmDelete(record.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </DashboardAsyncState>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete maintenance record?"
        description="This cannot be undone."
        tone="danger"
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
      />
    </div>
  );
}

const ATTACHMENT_KINDS = [
  { value: 'photo', label: 'Photo' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'handover', label: 'Handover' },
  { value: 'other', label: 'Other' },
];

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsTab({ assetId }: { assetId: string }) {
  const query = useApiResource<{ items: AssetAttachmentRecord[] }>(
    ['assets', 'attachments', assetId],
    `/api/assets/${assetId}/attachments`,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState('other');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const invalidateKeys = [['assets', 'attachments', assetId], LIST_KEY];

  const uploadMutation = useApiMutation(
    async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      const res = await fetch(`/api/assets/${assetId}/attachments`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Upload failed');
      return body;
    },
    {
      invalidateKeys,
      onSuccess: () => toast.success('File uploaded'),
      onError: (e) => toast.error(e.message),
    },
  );

  const deleteMutation = useApiMutation(
    (id: string) => apiFetch(`/api/assets/${assetId}/attachments/${id}`, { method: 'DELETE' }),
    {
      invalidateKeys,
      onSuccess: () => {
        toast.success('File removed');
        setConfirmDelete(null);
      },
      onError: (e) => toast.error(e.message),
    },
  );

  const items = query.data?.items ?? [];
  const status = query.isLoading ? 'loading' : query.isError ? 'error' : items.length === 0 ? 'empty' : 'success';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-3">
        <label className="block">
          <span className="text-xs font-medium text-[var(--dash-text-muted)]">Kind</span>
          <StrideSelect
            value={kind}
            onChange={setKind}
            options={ATTACHMENT_KINDS}
            ariaLabel="Attachment kind"
            className="mt-1 w-40"
          />
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2"
          disabled={uploadMutation.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload file
        </button>
      </div>

      <DashboardAsyncState
        status={status}
        error={query.error?.message}
        onRetry={() => void query.refetch()}
        empty={<p className="py-8 text-center text-sm text-[var(--dash-text-muted)]">No files attached yet.</p>}
      >
        <ul className="space-y-2">
          {items.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm"
            >
              <a
                href={file.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-primary-700 hover:underline"
              >
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{file.fileName}</span>
              </a>
              <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--dash-text-muted)]">
                {file.kind ? <span className="capitalize">{file.kind}</span> : null}
                <span>{formatFileSize(file.fileSize)}</span>
                <button
                  type="button"
                  className="rounded p-1 text-neutral-500 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setConfirmDelete(file.id)}
                  aria-label="Delete file"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </DashboardAsyncState>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete file?"
        description="This cannot be undone."
        tone="danger"
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
      />
    </div>
  );
}
