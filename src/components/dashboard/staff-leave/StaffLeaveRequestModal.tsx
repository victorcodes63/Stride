'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarOff, Info, Loader2, ShieldCheck, X } from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import {
  EMPTY_STAFF_LEAVE_META,
  LEAVE_PRIORITY_OPTIONS,
  serializeStaffLeaveReason,
  type LeavePriority,
  type StaffLeaveMeta,
} from '@/lib/staff-leave-meta';

export type RequestModalLeaveType = {
  id: string;
  name: string;
  daysPerYear: number;
  requiresApproval: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  types: RequestModalLeaveType[];
  onSubmitted: () => void;
};

const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20';
const labelClass = 'mb-1 block text-xs font-medium text-neutral-600';

function workingDaysBetween(startIso: string, endIso: string): number {
  const s = new Date(`${startIso}T12:00:00`);
  const e = new Date(`${endIso}T12:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  let n = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) n += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

function daysUntil(startIso: string): number {
  const target = new Date(`${startIso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function StaffLeaveRequestModal({ open, onClose, types, onSubmitted }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [meta, setMeta] = useState<StaffLeaveMeta>(EMPTY_STAFF_LEAVE_META);

  useEffect(() => {
    if (open) {
      setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      setMeta(EMPTY_STAFF_LEAVE_META);
      setSubmitting(false);
    }
  }, [open]);

  const workingDays = useMemo(
    () => (form.startDate && form.endDate ? workingDaysBetween(form.startDate, form.endDate) : 0),
    [form.startDate, form.endDate],
  );

  const selectedType = types.find((t) => t.id === form.leaveTypeId) ?? null;

  if (!open) return null;

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const updateMeta = (patch: Partial<StaffLeaveMeta>) => setMeta((m) => ({ ...m, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.leaveTypeId) {
      toast.error('Choose a leave type.');
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error('Pick a start and end date.');
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      toast.error('End date cannot be before the start date.');
      return;
    }
    if (
      meta.priority === 'high' &&
      daysUntil(form.startDate) < 7 &&
      !/emergency|urgent|sudden|incident/i.test(form.reason)
    ) {
      toast.error('High-priority roles need 7+ days notice unless this is an emergency (mention it in the reason).');
      return;
    }
    if (!meta.coveragePlan.trim()) {
      toast.error('A coverage plan is required.');
      return;
    }
    if (!meta.handoverNotes.trim()) {
      toast.error('Handover notes are required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/staff/leave/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaveTypeId: form.leaveTypeId,
          startDate: form.startDate,
          endDate: form.endDate,
          reason: serializeStaffLeaveReason(form.reason, meta),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not submit your request.');
      toast.success(
        selectedType && !selectedType.requiresApproval
          ? 'Leave recorded and auto-approved.'
          : 'Leave request submitted for approval.',
      );
      onSubmitted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit your request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Request leave"
      >
        <div className="flex items-start justify-between border-b border-neutral-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <CalendarOff className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-primary-900">Request leave</h3>
              <p className="text-xs text-neutral-500">Tell your approver how work stays covered while you are away.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 px-6 py-5">
          <div>
            <label className={labelClass}>Leave type</label>
            <StrideSelect
              value={form.leaveTypeId}
              onChange={(value) => update({ leaveTypeId: value })}
              options={[
                { value: '', label: 'Select a leave type…' },
                ...types.map((t) => ({
                  value: t.id,
                  label: `${t.name} (${t.daysPerYear} d/yr)${t.requiresApproval ? '' : ' · no approval'}`,
                })),
              ]}
              ariaLabel="Leave type"
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Start date</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => update({ startDate: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>End date</label>
              <input
                type="date"
                required
                value={form.endDate}
                onChange={(e) => update({ endDate: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          {workingDays > 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-800">
              <Info className="h-4 w-4 shrink-0" />
              This request covers <span className="font-semibold">{workingDays} working day{workingDays === 1 ? '' : 's'}</span>{' '}
              (weekends excluded).
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Team / department</label>
              <input
                value={meta.team}
                onChange={(e) => updateMeta({ team: e.target.value })}
                placeholder="e.g. Operations, Finance"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Your role</label>
              <input
                value={meta.role}
                onChange={(e) => updateMeta({ role: e.target.value })}
                placeholder="e.g. Analyst, Team lead"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Coverage priority</label>
              <StrideSelect
                value={meta.priority}
                onChange={(value) => updateMeta({ priority: value as LeavePriority })}
                options={LEAVE_PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                ariaLabel="Coverage priority"
                className="w-full"
              />
            </div>
            <div>
              <label className={labelClass}>Contact while away</label>
              <input
                value={meta.contactWhileAway}
                onChange={(e) => updateMeta({ contactWhileAway: e.target.value })}
                placeholder="Phone or alternate contact"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Coverage plan <span className="text-red-500">*</span></label>
            <textarea
              required
              value={meta.coveragePlan}
              onChange={(e) => updateMeta({ coveragePlan: e.target.value })}
              rows={2}
              placeholder="Who keeps things running while you are away?"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Handover notes <span className="text-red-500">*</span></label>
            <textarea
              required
              value={meta.handoverNotes}
              onChange={(e) => updateMeta({ handoverNotes: e.target.value })}
              rows={2}
              placeholder="Open items, deadlines, and anything your backup should know."
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelClass}>Backup person</label>
              <input
                value={meta.backupPerson}
                onChange={(e) => updateMeta({ backupPerson: e.target.value })}
                placeholder="Colleague covering for you"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Reason (optional)</label>
              <input
                value={form.reason}
                onChange={(e) => update({ reason: e.target.value })}
                placeholder="Add context for your approver"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50/60 px-3 py-2 text-xs text-primary-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Coverage and handover details travel with your request so approvers can review cover safely.
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
