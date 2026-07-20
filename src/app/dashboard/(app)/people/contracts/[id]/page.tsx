'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CalendarClock,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardBreadcrumbs } from '@/components/dashboard/DashboardBreadcrumbs';
import { DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { dashboardFilterInputClass } from '@/components/dashboard/DashboardFilterBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';

type ContractStatus = 'active' | 'expiring' | 'expired';

type ContractDetail = {
  id: string;
  title: string | null;
  reference: string | null;
  contractType: 'employee' | 'consultant';
  startDate: string | null;
  endDate: string;
  status: ContractStatus;
  remindersDisabled: boolean;
  managers: Array<{ id: string; name: string; email: string }>;
  updatedAt: string;
};

type StaffUser = { id: string; name: string; email: string };
type AttachmentItem = {
  name: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  url: string;
};

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

function stripPrefix(reference: string | null) {
  if (!reference) return '';
  return reference.replace(/^(EMP|CONS)-/i, '');
}

export default function PeopleContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [allUsers, setAllUsers] = useState<StaffUser[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    contractType: 'employee' as 'employee' | 'consultant',
    title: '',
    reference: '',
    startDate: '',
    endDate: '',
    remindersDisabled: false,
    managerIds: [] as string[],
  });

  const [renewOpen, setRenewOpen] = useState(false);
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewing, setRenewing] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AttachmentItem | null>(null);
  const [removingAttachment, setRemovingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadContract = useCallback(async (contractId: string) => {
    const res = await fetch(`/api/people/contracts/${contractId}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load contract');
    setContract(data);
  }, []);

  const loadAttachments = useCallback(async (contractId: string) => {
    const res = await fetch(`/api/people/contracts/${contractId}/attachments`, { cache: 'no-store' });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.error || 'Failed to load attachments');
    setAttachments(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([loadContract(id), loadAttachments(id)])
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load contract'))
      .finally(() => setLoading(false));
  }, [id, loadContract, loadAttachments]);

  useEffect(() => {
    fetch('/api/users?contractManagerPicker=1', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) =>
        setAllUsers(
          Array.isArray(d) ? d.map((u: StaffUser) => ({ id: u.id, name: u.name, email: u.email })) : [],
        ),
      )
      .catch(() => setAllUsers([]));
  }, []);

  const status = contract?.status ?? null;

  const openEdit = () => {
    if (!contract) return;
    setEditForm({
      contractType: contract.contractType,
      title: contract.title ?? '',
      reference: stripPrefix(contract.reference),
      startDate: contract.startDate ?? '',
      endDate: contract.endDate,
      remindersDisabled: contract.remindersDisabled,
      managerIds: contract.managers.map((m) => m.id),
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!id) return;
    if (!editForm.title.trim() || !editForm.endDate) {
      toast.error('Title and end date are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/people/contracts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          reference: editForm.reference,
          contractType: editForm.contractType,
          startDate: editForm.startDate || null,
          endDate: editForm.endDate,
          remindersDisabled: editForm.remindersDisabled,
          managerIds: editForm.managerIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save contract');
      toast.success('Contract updated.');
      setEditOpen(false);
      await loadContract(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save contract');
    } finally {
      setSaving(false);
    }
  };

  const openRenew = () => {
    if (!contract) return;
    setRenewEndDate(addMonths(contract.endDate, 12));
    setRenewOpen(true);
  };

  const handleRenew = async () => {
    if (!id || !contract || !renewEndDate) return;
    setRenewing(true);
    try {
      const start = new Date(`${contract.endDate}T12:00:00`);
      start.setDate(start.getDate() + 1);
      const res = await fetch(`/api/people/contracts/${id}/renew`, {
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
      setRenewOpen(false);
      if (data.id) router.push(`/dashboard/people/contracts/${data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to renew contract');
    } finally {
      setRenewing(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/people/contracts/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete contract');
      toast.success('Contract deleted.');
      router.push('/dashboard/people/contracts');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete contract');
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const uploadFile = useCallback(
    (file: File) => {
      if (!id) return;
      if (file.type !== 'application/pdf') {
        toast.error('Only PDF files are allowed.');
        return;
      }
      setUploading(true);
      setUploadProgress(0);
      const fd = new FormData();
      fd.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/people/contracts/${id}/attachments`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        setUploading(false);
        setUploadProgress(0);
        if (xhr.status >= 200 && xhr.status < 300) {
          toast.success('Attachment uploaded.');
          void loadAttachments(id);
        } else {
          let message = 'Failed to upload attachment';
          try {
            message = JSON.parse(xhr.responseText).error || message;
          } catch {
            // keep default
          }
          toast.error(message);
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        setUploadProgress(0);
        toast.error('Failed to upload attachment');
      };
      xhr.send(fd);
    },
    [id, loadAttachments],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const removeAttachment = async () => {
    if (!id || !pendingDelete) return;
    setRemovingAttachment(true);
    try {
      const res = await fetch(
        `/api/people/contracts/${id}/attachments?name=${encodeURIComponent(pendingDelete.name)}`,
        { method: 'DELETE' },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete attachment');
      toast.success('Attachment removed.');
      setPendingDelete(null);
      await loadAttachments(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete attachment');
    } finally {
      setRemovingAttachment(false);
    }
  };

  const breadcrumbs = useMemo(
    () => [
      { label: 'Contracts', href: '/dashboard/people/contracts' },
      { label: contract?.title || 'Contract detail' },
    ],
    [contract?.title],
  );

  if (loading) {
    return (
      <DashboardPage>
        <DashboardPageSkeleton variant="detail" />
      </DashboardPage>
    );
  }

  if (!contract) {
    return (
      <DashboardPage>
        <div className="dashboard-surface border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error || 'Contract not found'}
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <DashboardBreadcrumbs crumbs={breadcrumbs} />

      <DashboardPageHeader
        title={contract.title || 'Contract'}
        icon={FileText}
        description={`${contract.contractType === 'consultant' ? 'Consultant doctor contract' : 'Employee contract'} · Ref: ${contract.reference || '—'}`}
        badges={
          status
            ? [
                {
                  label: (
                    <span className={dashStatusChip(STATUS_TONE[status])}>{STATUS_LABEL[status]}</span>
                  ),
                  bare: true,
                },
              ]
            : []
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={openEdit} className="btn-secondary inline-flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            <button type="button" onClick={openRenew} className="btn-primary inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Renew
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <InfoCard label="Start date" value={contract.startDate || '—'} />
        <InfoCard label="End date" value={contract.endDate} />
        <InfoCard label="Last updated" value={new Date(contract.updatedAt).toLocaleString()} />
      </div>

      <section className="dashboard-surface p-5">
        <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Contract managers</h2>
        <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
          Managers receive expiry reminders {contract.remindersDisabled ? '(currently disabled)' : ''}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {contract.managers.length ? (
            contract.managers.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-2.5 py-1 text-xs text-[var(--dash-text)]"
              >
                {m.name}
              </span>
            ))
          ) : (
            <span className="text-sm text-[var(--dash-text-muted)]">No managers assigned.</span>
          )}
        </div>
      </section>

      <section className="dashboard-surface p-5">
        <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Signed PDF attachments</h2>

        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragActive
              ? 'border-primary-400 bg-primary-50/50'
              : 'border-[var(--dash-border)] hover:border-primary-300 hover:bg-[var(--dash-hover)]'
          }`}
        >
          <UploadCloud className="h-8 w-8 text-[var(--dash-text-muted)]" aria-hidden />
          <p className="text-sm text-[var(--dash-text)]">
            {uploading ? 'Uploading…' : 'Drag & drop a PDF here, or click to browse'}
          </p>
          <p className="text-xs text-[var(--dash-text-muted)]">PDF only · max 10MB</p>
          {uploading ? (
            <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-[var(--dash-border)]">
              <div
                className="h-full rounded-full bg-primary-600 transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.currentTarget.value = '';
            }}
          />
        </div>

        <div className="mt-4 space-y-2">
          {attachments.length === 0 ? (
            <p className="text-xs text-[var(--dash-text-muted)]">No signed documents uploaded yet.</p>
          ) : (
            attachments.map((a) => (
              <div
                key={a.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-[var(--dash-text-muted)]" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--dash-text)]">{a.originalName}</p>
                    <p className="text-xs text-[var(--dash-text-muted)]">
                      {(a.size / 1024 / 1024).toFixed(2)} MB · {new Date(a.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary px-3 py-1.5 text-xs"
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(a)}
                    className="rounded-lg border border-[var(--dash-border)] p-1.5 text-red-600 hover:bg-red-50"
                    aria-label={`Delete ${a.originalName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="dashboard-surface border border-red-200/70 p-5">
        <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Danger zone</h2>
        <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
          Deleting a contract permanently removes it and its manager assignments.
        </p>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete contract
        </button>
      </section>

      <DashboardModal
        open={editOpen}
        onClose={() => (saving ? undefined : setEditOpen(false))}
        title="Edit contract"
        size="lg"
        dismissible={!saving}
        icon={<Pencil className="h-5 w-5" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditOpen(false)}
              disabled={saving}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save changes
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contract type">
            <StrideSelect
              value={editForm.contractType}
              onChange={(value) =>
                setEditForm((f) => ({ ...f, contractType: value as 'employee' | 'consultant' }))
              }
              options={[
                { value: 'employee', label: 'Employee contract' },
                { value: 'consultant', label: 'Consultant doctor contract' },
              ]}
              ariaLabel="Contract type"
            />
          </Field>
          <Field label="Contract party / title">
            <input
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              className={dashboardFilterInputClass}
            />
          </Field>
          <Field label="Reference (optional)">
            <input
              value={editForm.reference}
              onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))}
              placeholder="e.g. 2026-014"
              className={dashboardFilterInputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input
                type="date"
                value={editForm.startDate}
                onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                className={dashboardFilterInputClass}
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={editForm.endDate}
                onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                className={dashboardFilterInputClass}
              />
            </Field>
          </div>
        </div>

        {allUsers.length ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[var(--dash-text-muted)]">Contract managers</p>
            <div className="flex flex-wrap gap-2">
              {allUsers.map((u) => (
                <label
                  key={u.id}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-2.5 py-1.5 text-xs text-[var(--dash-text)]"
                >
                  <input
                    type="checkbox"
                    checked={editForm.managerIds.includes(u.id)}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        managerIds: e.target.checked
                          ? [...f.managerIds, u.id]
                          : f.managerIds.filter((x) => x !== u.id),
                      }))
                    }
                  />
                  {u.name}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--dash-text)]">
          <input
            type="checkbox"
            checked={editForm.remindersDisabled}
            onChange={(e) => setEditForm((f) => ({ ...f, remindersDisabled: e.target.checked }))}
          />
          Disable expiry reminders for this contract
        </label>
      </DashboardModal>

      <ConfirmDialog
        open={renewOpen}
        title="Renew contract"
        confirmLabel="Renew"
        loading={renewing}
        onCancel={() => (renewing ? undefined : setRenewOpen(false))}
        onConfirm={handleRenew}
        description={
          <div className="space-y-3">
            <p className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" aria-hidden />
              Creates a new contract starting the day after this one ends, carrying over managers.
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

      <ConfirmDialog
        open={deleteOpen}
        title="Delete contract"
        tone="danger"
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => (deleting ? undefined : setDeleteOpen(false))}
        onConfirm={handleDelete}
        description="This permanently removes the contract and its manager assignments. This cannot be undone."
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete attachment"
        tone="danger"
        confirmLabel="Delete"
        loading={removingAttachment}
        onCancel={() => (removingAttachment ? undefined : setPendingDelete(null))}
        onConfirm={removeAttachment}
        description={
          pendingDelete ? `Remove "${pendingDelete.originalName}" from this contract?` : undefined
        }
      />
    </DashboardPage>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-surface p-4">
      <p className="text-xs text-[var(--dash-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--dash-text)]">{value}</p>
    </div>
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
