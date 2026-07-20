'use client';

import { Loader2, Scale } from 'lucide-react';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { StrideSelect } from '@/components/ui/stride-select';
import {
  CATEGORY_LABEL,
  OBLIGATION_CATEGORIES,
  OBLIGATION_PRIORITIES,
  PRIORITY_LABEL,
  selectOptions,
  type LegalObligationCategory,
  type LegalObligationPriority,
} from '@/lib/legal/constants';
import type { ObligationFormState, ObligationOwner } from './ObligationTypes';

const CATEGORY_OPTIONS = selectOptions(OBLIGATION_CATEGORIES, CATEGORY_LABEL);
const PRIORITY_OPTIONS = selectOptions(OBLIGATION_PRIORITIES, PRIORITY_LABEL);

export function ObligationFormModal({
  open,
  editing,
  form,
  owners,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: boolean;
  form: ObligationFormState;
  owners: ObligationOwner[];
  saving: boolean;
  onChange: (patch: Partial<ObligationFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const ownerOptions = [
    { value: '', label: 'Unassigned' },
    ...owners.map((o) => ({ value: o.id, label: o.name })),
  ];

  return (
    <DashboardModal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit obligation' : 'New obligation'}
      description="Track a statutory filing, permit, board action, or regulator deadline."
      icon={<Scale className="h-5 w-5" />}
      size="lg"
      dismissible={!saving}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Create obligation'}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Title *">
          <input
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. Annual return filing"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Category">
          <StrideSelect
            value={form.category}
            onChange={(v) => onChange({ category: v as LegalObligationCategory })}
            options={CATEGORY_OPTIONS}
            ariaLabel="Category"
            className="mt-1 w-full"
          />
        </Field>
        <Field label="Priority">
          <StrideSelect
            value={form.priority}
            onChange={(v) => onChange({ priority: v as LegalObligationPriority })}
            options={PRIORITY_OPTIONS}
            ariaLabel="Priority"
            className="mt-1 w-full"
          />
        </Field>
        <Field label="Due date *">
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => onChange({ dueDate: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Owner">
          <StrideSelect
            value={form.ownerUserId}
            onChange={(v) => onChange({ ownerUserId: v })}
            options={ownerOptions}
            ariaLabel="Owner"
            className="mt-1 w-full"
          />
        </Field>
        <Field label="Reminder lead (days)">
          <input
            type="number"
            min="0"
            value={form.reminderDays}
            onChange={(e) => onChange({ reminderDays: e.target.value })}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Recurrence (months)">
          <input
            type="number"
            min="0"
            value={form.recurrenceMonths}
            onChange={(e) => onChange({ recurrenceMonths: e.target.value })}
            placeholder="Leave blank for one-off"
            className={INPUT_CLASS}
          />
        </Field>
        <Field className="sm:col-span-2" label="Regulator / authority">
          <input
            value={form.regulator}
            onChange={(e) => onChange({ regulator: e.target.value })}
            placeholder="e.g. Registrar of Companies"
            className={INPUT_CLASS}
          />
        </Field>
        <Field className="sm:col-span-2" label="Description">
          <textarea
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field className="sm:col-span-2" label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </Field>
      </div>
    </DashboardModal>
  );
}

const INPUT_CLASS =
  'mt-1 h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/30';
const TEXTAREA_CLASS =
  'mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/30 resize-y';

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      {children}
    </label>
  );
}
