'use client';

import { X } from 'lucide-react';
import { StrideButton } from '@/components/ui/stride-button';
import { StrideSelect } from '@/components/ui/stride-select';
import type { Assignee, StaffTask } from './types';
import { INPUT_CLASS } from './task-utils';

export type TaskEditForm = {
  title: string;
  description: string;
  assigneeId: string;
  dueAt: string;
  priority: StaffTask['priority'];
  status: StaffTask['status'];
};

type Props = {
  assignees: Assignee[];
  form: TaskEditForm;
  submitting: boolean;
  onClose: () => void;
  onChange: (patch: Partial<TaskEditForm>) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function TaskEditModal({
  assignees,
  form,
  submitting,
  onClose,
  onChange,
  onSubmit,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-primary-900/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/80">
          <div>
            <h2 id="edit-task-title" className="font-semibold text-primary-900 text-lg">
              Edit task
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">Update details, assignee, or status</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-neutral-200/80 text-neutral-500 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label htmlFor="task-title" className="block text-xs font-semibold text-neutral-600 mb-1.5">
              Title
            </label>
            <input
              id="task-title"
              required
              value={form.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="task-notes" className="block text-xs font-semibold text-neutral-600 mb-1.5">
              Notes
            </label>
            <textarea
              id="task-notes"
              rows={3}
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Optional context or checklist…"
              className={`${INPUT_CLASS} resize-y min-h-[80px]`}
            />
          </div>
          <div>
            <label htmlFor="task-assignee" className="block text-xs font-semibold text-neutral-600 mb-1.5">
              Assign to
            </label>
            <StrideSelect
              id="task-assignee"
              value={form.assigneeId}
              onChange={(next) => onChange({ assigneeId: next })}
              options={[
                { value: '', label: 'Unassigned' },
                ...assignees.map((a) => ({ value: a.id, label: a.name })),
              ]}
              placeholder="Unassigned"
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="task-due" className="block text-xs font-semibold text-neutral-600 mb-1.5">
              Due date
            </label>
            <input
              id="task-due"
              type="date"
              value={form.dueAt}
              onChange={(e) => onChange({ dueAt: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-priority" className="block text-xs font-semibold text-neutral-600 mb-1.5">
                Priority
              </label>
              <StrideSelect
                id="task-priority"
                value={form.priority}
                onChange={(next) => onChange({ priority: next as StaffTask['priority'] })}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="task-status" className="block text-xs font-semibold text-neutral-600 mb-1.5">
                Status
              </label>
              <StrideSelect
                id="task-status"
                value={form.status}
                onChange={(next) => onChange({ status: next as StaffTask['status'] })}
                options={[
                  { value: 'todo', label: 'To do' },
                  { value: 'in_progress', label: 'In progress' },
                  { value: 'done', label: 'Done' },
                ]}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-neutral-100">
            <StrideButton
              variant="primary"
              type="submit"
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? 'Saving…' : 'Save changes'}
            </StrideButton>
            <StrideButton variant="secondary" onClick={onClose}>
              Cancel
            </StrideButton>
          </div>
        </form>
      </div>
    </div>
  );
}
