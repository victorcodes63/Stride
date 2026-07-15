'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';

type WorkflowOption = {
  id: string;
  type: string;
  employee: { firstName: string; lastName: string };
};

type AssigneeOption = {
  id: string;
  name: string;
  email: string;
};

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

export function CreateOnboardingTaskModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [createOnePerAssignee, setCreateOnePerAssignee] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    setError(null);
    try {
      const [wfRes, asRes] = await Promise.all([
        fetch('/api/onboarding/workflows?status=IN_PROGRESS'),
        fetch('/api/onboarding/assignees'),
      ]);
      const wfData = await wfRes.json().catch(() => []);
      const asData = await asRes.json().catch(() => []);
      if (!wfRes.ok) throw new Error(wfData.error || 'Failed to load workflows.');
      if (!asRes.ok) throw new Error(asData.error || 'Failed to load assignees.');
      setWorkflows(Array.isArray(wfData) ? wfData : []);
      setAssignees(Array.isArray(asData) ? asData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load form data.');
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const filteredAssignees = useMemo(() => {
    const q = assigneeQuery.trim().toLowerCase();
    if (!q) return assignees;
    return assignees.filter(
      (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
    );
  }, [assigneeQuery, assignees]);

  function toggleAssignee(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task name is required.');
      return;
    }
    if (!workflowId) {
      setError('Belongs to (workflow) is required.');
      return;
    }
    if (selectedIds.length === 0) {
      setError('At least one assignee is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          workflowId,
          assigneeIds: selectedIds,
          createOnePerAssignee,
          dueDate: dueDate || null,
          startDate: startDate || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not create task.');

      const createdTasks = Array.isArray(body) ? body : [body];
      if (file && createdTasks[0]?.id) {
        const form = new FormData();
        form.append('file', file);
        const uploadRes = await fetch(`/api/onboarding/tasks/${createdTasks[0].id}/attachments`, {
          method: 'POST',
          body: form,
        });
        const uploadBody = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          throw new Error(uploadBody.error || 'Task created but file upload failed.');
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-onboarding-task-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--dash-border)] px-5 py-4">
          <div>
            <h2 id="create-onboarding-task-title" className="text-lg font-semibold text-[var(--dash-text)]">
              Create a task
            </h2>
            <p className="mt-0.5 text-sm text-[var(--dash-text-muted)]">
              Add an ad-hoc step to an active onboarding or offboarding workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 px-5 py-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {loadingMeta ? (
            <div className="flex items-center gap-2 py-8 text-sm text-[var(--dash-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">
                  Task name <span className="text-red-600">*</span>
                </span>
                <input
                  className="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm"
                  placeholder="Enter task name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Description</span>
                <textarea
                  className="min-h-[88px] w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What needs to get done?"
                />
              </label>

              <div>
                <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">
                  Assignees <span className="text-red-600">*</span>
                </span>
                <input
                  className="mb-2 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm"
                  placeholder="Search people…"
                  value={assigneeQuery}
                  onChange={(e) => setAssigneeQuery(e.target.value)}
                />
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[var(--dash-border)] p-2">
                  {filteredAssignees.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-[var(--dash-text-muted)]">No matching people.</p>
                  ) : (
                    filteredAssignees.map((person) => {
                      const checked = selectedIds.includes(person.id);
                      return (
                        <label
                          key={person.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--dash-hover)]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAssignee(person.id)}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {person.name}
                            <span className="ml-1 text-xs text-[var(--dash-text-muted)]">{person.email}</span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {selectedIds.length > 0 ? (
                  <p className="mt-1.5 text-xs text-[var(--dash-text-muted)]">
                    {selectedIds.length} selected
                  </p>
                ) : null}
                <label className="mt-2 flex items-center gap-2 text-sm text-[var(--dash-text)]">
                  <input
                    type="checkbox"
                    checked={createOnePerAssignee}
                    onChange={(e) => setCreateOnePerAssignee(e.target.checked)}
                  />
                  Create one task per assignee
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Start date</span>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Due date</span>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">
                  Belongs to <span className="text-red-600">*</span>
                </span>
                <select
                  className="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm"
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  required
                >
                  <option value="">Select active workflow…</option>
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>
                      {wf.type} · {wf.employee.firstName} {wf.employee.lastName}
                    </option>
                  ))}
                </select>
                {workflows.length === 0 ? (
                  <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
                    No active workflows. Start onboarding or offboarding first.
                  </p>
                ) : null}
              </label>

              <div>
                <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Files</span>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-4 py-6 text-center text-sm text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]">
                  <Upload className="h-5 w-5" />
                  <span>{file ? file.name : 'Drag and drop a PDF, or click to select.'}</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
                  Optional. PDF only. Attached to the first created task as evidence.
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--dash-border)] pt-4">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loadingMeta}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
