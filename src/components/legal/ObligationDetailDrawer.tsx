'use client';

import { useRef } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  RotateCcw,
  Scale,
  Trash2,
  Upload,
  UserPlus,
  Ban,
} from 'lucide-react';
import { DashboardDrawer } from '@/components/dashboard/DashboardDrawer';
import { StrideSelect } from '@/components/ui/stride-select';
import { LegalStatusBadge, PriorityBadge } from '@/components/legal/LegalBadges';
import { CATEGORY_LABEL } from '@/lib/legal/constants';
import type { ObligationDetail, ObligationEvent, ObligationOwner } from './ObligationTypes';

const EVENT_LABEL: Record<ObligationEvent['type'], string> = {
  created: 'Created',
  updated: 'Updated',
  assigned: 'Owner assigned',
  status_changed: 'Status changed',
  completed: 'Marked complete',
  waived: 'Waived',
  reopened: 'Reopened',
  evidence_uploaded: 'Evidence uploaded',
  evidence_removed: 'Evidence removed',
};

function eventTone(type: ObligationEvent['type']): string {
  switch (type) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700';
    case 'waived':
      return 'bg-neutral-200 text-neutral-600';
    case 'reopened':
      return 'bg-amber-100 text-amber-700';
    case 'assigned':
      return 'bg-sky-100 text-sky-700';
    case 'evidence_uploaded':
    case 'evidence_removed':
      return 'bg-violet-100 text-violet-700';
    default:
      return 'bg-primary-100 text-primary-700';
  }
}

export function ObligationDetailDrawer({
  open,
  onClose,
  detail,
  loading,
  owners,
  busy,
  uploading,
  onAssign,
  onComplete,
  onWaive,
  onReopen,
  onDelete,
  onEdit,
  onUploadEvidence,
  onRemoveEvidence,
}: {
  open: boolean;
  onClose: () => void;
  detail: ObligationDetail | null;
  loading: boolean;
  owners: ObligationOwner[];
  busy: boolean;
  uploading: boolean;
  onAssign: (ownerUserId: string) => void;
  onComplete: () => void;
  onWaive: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onUploadEvidence: (file: File) => void;
  onRemoveEvidence: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const ownerOptions = [
    { value: '', label: 'Unassigned' },
    ...owners.map((o) => ({ value: o.id, label: o.name })),
  ];

  return (
    <DashboardDrawer
      open={open}
      onClose={onClose}
      eyebrow={detail ? CATEGORY_LABEL[detail.category] : 'Obligation'}
      title={detail?.title ?? 'Obligation'}
      icon={<Scale className="h-5 w-5" />}
      width="lg"
      headerAside={
        detail ? (
          <div className="flex items-center gap-2">
            <PriorityBadge priority={detail.priority} />
            <LegalStatusBadge status={detail.status} />
          </div>
        ) : null
      }
      footer={
        detail ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={onEdit} disabled={busy} className="btn-secondary inline-flex items-center gap-1.5">
                <Pencil className="h-4 w-4" /> Edit
              </button>
              {detail.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    onClick={onWaive}
                    disabled={busy}
                    className="btn-secondary inline-flex items-center gap-1.5"
                  >
                    <Ban className="h-4 w-4" /> Waive
                  </button>
                  <button
                    type="button"
                    onClick={onComplete}
                    disabled={busy}
                    className="btn-primary inline-flex items-center gap-1.5"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Mark complete
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onReopen}
                  disabled={busy}
                  className="btn-primary inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" /> Reopen
                </button>
              )}
            </div>
          </div>
        ) : null
      }
    >
      {loading || !detail ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Detail label="Due date" value={detail.dueDate} numeric />
            <Detail label="Regulator" value={detail.regulator ?? '—'} />
            <Detail label="Reminder lead" value={`${detail.reminderDays} days`} />
            <Detail
              label="Recurrence"
              value={detail.recurrenceMonths ? `Every ${detail.recurrenceMonths} months` : 'One-off'}
            />
            {detail.completedAt ? (
              <Detail label="Completed" value={detail.completedAt.slice(0, 10)} numeric />
            ) : null}
            {detail.waivedReason ? (
              <Detail className="col-span-2" label="Waiver reason" value={detail.waivedReason} />
            ) : null}
          </dl>

          {detail.description ? (
            <Section title="Description">
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{detail.description}</p>
            </Section>
          ) : null}
          {detail.notes ? (
            <Section title="Notes">
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{detail.notes}</p>
            </Section>
          ) : null}

          <Section title="Owner">
            <StrideSelect
              value={detail.owner?.id ?? ''}
              onChange={onAssign}
              options={ownerOptions}
              ariaLabel="Assign owner"
              className="w-full sm:w-72"
            />
          </Section>

          <Section title="Evidence">
            {detail.evidencePath ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={detail.evidencePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  <FileText className="h-4 w-4 text-primary-600" />
                  {detail.evidenceFileName ?? 'Evidence.pdf'}
                  <Download className="h-3.5 w-3.5 text-neutral-400" />
                </a>
                <button
                  type="button"
                  onClick={onRemoveEvidence}
                  disabled={busy || uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload PDF
                </button>
                <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                  <Paperclip className="h-3.5 w-3.5" /> PDF only, up to 10MB
                </span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadEvidence(file);
                e.target.value = '';
              }}
            />
          </Section>

          <Section title="Activity">
            {detail.events.length === 0 ? (
              <p className="text-sm text-neutral-500">No activity recorded yet.</p>
            ) : (
              <ol className="space-y-3">
                {detail.events.map((ev) => (
                  <li key={ev.id} className="flex gap-3">
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${eventTone(ev.type)}`}
                      aria-hidden
                    >
                      {EVENT_LABEL[ev.type].charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {EVENT_LABEL[ev.type]}
                        {ev.fromStatus && ev.toStatus ? (
                          <span className="font-normal text-neutral-500">
                            {' '}
                            · {ev.fromStatus} → {ev.toStatus}
                          </span>
                        ) : null}
                      </p>
                      {ev.note ? <p className="text-xs text-neutral-600">{ev.note}</p> : null}
                      <p className="text-xs text-neutral-400">
                        {new Date(ev.createdAt).toLocaleString()}
                        {ev.actor ? ` · ${ev.actor.name}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      )}
    </DashboardDrawer>
  );
}

function Detail({
  label,
  value,
  numeric,
  className,
}: {
  label: string;
  value: string;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className={`mt-0.5 text-sm text-ink ${numeric ? 'tabular-nums' : ''}`}>{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</h3>
      {children}
    </section>
  );
}
