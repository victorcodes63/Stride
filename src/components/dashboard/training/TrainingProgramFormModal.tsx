'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { GraduationCap, Loader2, X } from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import {
  TRAINING_STATUSES,
  TRAINING_STATUS_LABEL,
  type TrainingProgramDetail,
  type TrainingProgramInput,
  type TrainingProgramSummary,
  type TrainingStatus,
} from '@/lib/training/types';

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR', 'GHS', 'TZS', 'UGX', 'INR'];

type ProgramLike = TrainingProgramSummary | TrainingProgramDetail;

type TrainingProgramFormModalProps = {
  open: boolean;
  onClose: () => void;
  /** Existing program to edit; omit for create mode. */
  program?: ProgramLike | null;
  /** Category suggestions built from loaded data. */
  categoryOptions?: string[];
  /** Called after a successful create/update with the resulting program id. */
  onSaved: (result: { id: string; created: boolean }) => void;
};

type FormState = {
  title: string;
  category: string;
  description: string;
  provider: string;
  location: string;
  isOnline: boolean;
  startDate: string;
  endDate: string;
  durationHours: string;
  maxParticipants: string;
  cost: string;
  currency: string;
  status: TrainingStatus;
  notes: string;
};

function toDateInput(value: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function buildInitialState(program?: ProgramLike | null): FormState {
  return {
    title: program?.title ?? '',
    category: program?.category ?? '',
    description: program?.description ?? '',
    provider: program?.provider ?? '',
    location: program?.location ?? '',
    isOnline: program?.isOnline ?? false,
    startDate: toDateInput(program?.startDate ?? null),
    endDate: toDateInput(program?.endDate ?? null),
    durationHours: program?.durationHours != null ? String(program.durationHours) : '',
    maxParticipants: program?.maxParticipants != null ? String(program.maxParticipants) : '',
    cost: program?.cost != null ? String(program.cost) : '',
    currency: program?.currency ?? 'USD',
    status: program?.status ?? 'scheduled',
    notes: (program && 'notes' in program ? program.notes : '') ?? '',
  };
}

const labelClass = 'mb-1 block text-xs font-medium text-[var(--dash-text-muted)]';
const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-ink placeholder:text-neutral-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500/30';

export function TrainingProgramFormModal({
  open,
  onClose,
  program,
  categoryOptions = [],
  onSaved,
}: TrainingProgramFormModalProps) {
  const isEdit = Boolean(program);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildInitialState(program));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset the form whenever the modal (re)opens or the target program changes.
  useEffect(() => {
    if (open) setForm(buildInitialState(program));
  }, [open, program]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  const categorySuggestionId = 'training-category-suggestions';
  const dedupedCategories = useMemo(
    () => Array.from(new Set(categoryOptions.filter(Boolean))),
    [categoryOptions],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Program title is required.');
      return;
    }
    setSubmitting(true);

    const payload: TrainingProgramInput = {
      title: form.title.trim(),
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      provider: form.provider.trim() || null,
      location: form.isOnline ? null : form.location.trim() || null,
      isOnline: form.isOnline,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      durationHours: form.durationHours ? Number(form.durationHours) : null,
      maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : null,
      cost: form.cost ? Number(form.cost) : null,
      currency: form.currency || 'USD',
      status: form.status,
      notes: form.notes.trim() || null,
    };

    try {
      const res = await fetch(isEdit ? `/api/training/${program!.id}` : '/api/training', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      const id: string = isEdit ? program!.id : data.id ?? data.program?.id;
      toast.success(isEdit ? 'Program updated.' : 'Program created.');
      onSaved({ id, created: !isEdit });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save program.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="training-form-title"
        className="my-8 w-full max-w-2xl rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--dash-border)] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h2 id="training-form-title" className="text-base font-semibold text-[var(--dash-text-strong)]">
                {isEdit ? 'Edit training program' : 'New training program'}
              </h2>
              <p className="text-xs text-[var(--dash-text-muted)]">
                {isEdit ? 'Update the details of this program.' : 'Set up a program to develop your team.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="tp-title" className={labelClass}>
                Program title <span className="text-red-500">*</span>
              </label>
              <input
                id="tp-title"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Leadership Essentials"
                className={inputClass}
                autoFocus
                required
              />
            </div>

            <div>
              <label htmlFor="tp-category" className={labelClass}>
                Category
              </label>
              <input
                id="tp-category"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                placeholder="Leadership, Technical…"
                className={inputClass}
                list={categorySuggestionId}
              />
              {dedupedCategories.length > 0 ? (
                <datalist id={categorySuggestionId}>
                  {dedupedCategories.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              ) : null}
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <StrideSelect
                value={form.status}
                onChange={(value) => update('status', value as TrainingStatus)}
                options={TRAINING_STATUSES.map((status) => ({
                  value: status,
                  label: TRAINING_STATUS_LABEL[status],
                }))}
                ariaLabel="Program status"
                className="w-full"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="tp-description" className={labelClass}>
                Description
              </label>
              <textarea
                id="tp-description"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={2}
                placeholder="What will participants learn?"
                className={`${inputClass} resize-y`}
              />
            </div>

            <div>
              <label htmlFor="tp-provider" className={labelClass}>
                Provider
              </label>
              <input
                id="tp-provider"
                value={form.provider}
                onChange={(e) => update('provider', e.target.value)}
                placeholder="Internal or vendor name"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tp-location" className={labelClass}>
                Location
              </label>
              <input
                id="tp-location"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                placeholder={form.isOnline ? 'Online — no venue needed' : 'Venue or city'}
                className={inputClass}
                disabled={form.isOnline}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-[var(--dash-text-body)]">
                <input
                  type="checkbox"
                  checked={form.isOnline}
                  onChange={(e) => update('isOnline', e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/30"
                />
                Online / virtual delivery
              </label>
            </div>

            <div>
              <label htmlFor="tp-start" className={labelClass}>
                Start date
              </label>
              <input
                id="tp-start"
                type="date"
                value={form.startDate}
                onChange={(e) => update('startDate', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tp-end" className={labelClass}>
                End date
              </label>
              <input
                id="tp-end"
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => update('endDate', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tp-duration" className={labelClass}>
                Duration (hours)
              </label>
              <input
                id="tp-duration"
                type="number"
                min="0"
                step="0.5"
                value={form.durationHours}
                onChange={(e) => update('durationHours', e.target.value)}
                placeholder="e.g. 8"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tp-max" className={labelClass}>
                Max participants
              </label>
              <input
                id="tp-max"
                type="number"
                min="0"
                step="1"
                value={form.maxParticipants}
                onChange={(e) => update('maxParticipants', e.target.value)}
                placeholder="Leave blank for unlimited"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="tp-cost" className={labelClass}>
                Cost
              </label>
              <input
                id="tp-cost"
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={(e) => update('cost', e.target.value)}
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Currency</label>
              <StrideSelect
                value={form.currency}
                onChange={(value) => update('currency', value)}
                options={CURRENCY_OPTIONS.map((code) => ({ value: code, label: code }))}
                ariaLabel="Currency"
                className="w-full"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="tp-notes" className={labelClass}>
                Internal notes
              </label>
              <textarea
                id="tp-notes"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                rows={2}
                placeholder="Private notes for organisers"
                className={`${inputClass} resize-y`}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--dash-border)] pt-4">
            <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Create program'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
