'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';

export type DepartmentRecord = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  headEmployeeId: string | null;
  headName: string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  isActive: boolean;
  employeeCount: number;
};

type EmployeeOption = { id: string; firstName: string; lastName: string };

type Props = {
  /** End-client id for outsourcing surface; unused for internal `/api/departments`. */
  clientId?: string;
  /** List/create/update base, e.g. `/api/departments` or `/api/outsourcing/clients/:id/departments`. */
  apiBase: string;
  /** Employee directory for head picker. */
  employeesApi: string;
  department?: DepartmentRecord | null;
  onClose: () => void;
  onSaved: (dept: DepartmentRecord) => void;
};

export function DepartmentFormModal({
  apiBase,
  employeesApi,
  department,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!department;
  const [name, setName] = useState(department?.name ?? '');
  const [code, setCode] = useState(department?.code ?? '');
  const [description, setDescription] = useState(department?.description ?? '');
  const [headEmployeeId, setHeadEmployeeId] = useState(department?.headEmployeeId ?? '');
  const [costCenterCode, setCostCenterCode] = useState(department?.costCenterCode ?? '');
  const [costCenterName, setCostCenterName] = useState(department?.costCenterName ?? '');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(employeesApi);
        const data = await res.json().catch(() => []);
        if (!cancelled && Array.isArray(data)) {
          setEmployees(data.map((e: EmployeeOption) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName })));
        }
      } catch {
        /* head selection is optional; ignore load failures */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeesApi]);

  const headOptions = useMemo(
    () => [
      { value: '', label: 'No department head' },
      ...employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}`.trim() })),
    ],
    [employees],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Department name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        headEmployeeId: headEmployeeId || null,
        costCenterCode: costCenterCode.trim() || null,
        costCenterName: costCenterName.trim() || null,
      };
      const url = isEdit ? `${apiBase}/${department!.id}` : apiBase;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save department.');
      onSaved(data as DepartmentRecord);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save department.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40">
      <button type="button" aria-label="Close" className="flex-1 cursor-default" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="department-form-title"
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--dash-border)] px-5 py-4">
          <div>
            <h2 id="department-form-title" className="text-lg font-semibold text-[var(--dash-text)]">
              {isEdit ? 'Edit department' : 'New department'}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--dash-text-muted)]">
              Group employees for org structure, payroll filters, and reporting.
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

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col gap-4 px-5 py-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
              {error}
            </div>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">
              Name <span className="text-red-600">*</span>
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Finance"
              maxLength={120}
              className="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">
              Code <span className="text-xs font-normal text-[var(--dash-text-muted)]">(optional, for exports)</span>
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. FIN"
              maxLength={24}
              className="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm uppercase"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this department covers"
              className="min-h-[72px] w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Department head</span>
            <StrideSelect
              value={headEmployeeId}
              onChange={setHeadEmployeeId}
              options={headOptions}
              ariaLabel="Department head"
              className="w-full"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">
                Cost centre code{' '}
                <span className="text-xs font-normal text-[var(--dash-text-muted)]">(optional)</span>
              </span>
              <input
                value={costCenterCode}
                onChange={(e) => setCostCenterCode(e.target.value)}
                placeholder="e.g. CC-100"
                maxLength={40}
                className="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
                Finance/GL tag for budgets — not the department name.
              </p>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">
                Cost centre name{' '}
                <span className="text-xs font-normal text-[var(--dash-text-muted)]">(optional)</span>
              </span>
              <input
                value={costCenterName}
                onChange={(e) => setCostCenterName(e.target.value)}
                placeholder="e.g. Head Office"
                maxLength={120}
                className="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-auto flex justify-end gap-2 border-t border-[var(--dash-border)] pt-4">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save changes' : 'Create department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
