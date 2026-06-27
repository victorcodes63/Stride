'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';

type TemplateRow = {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  _count: { steps: number; workflows: number };
};

type TemplateDetail = TemplateRow & {
  steps: Array<{
    id: string;
    title: string;
    assignedRole: string;
    category: string | null;
    order: number;
    dueDaysOffset: number;
    isRequired: boolean;
  }>;
};

const ROLES = ['hr', 'it', 'department_head', 'employee', 'admin'];

export default function OnboardingTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('ONBOARDING');
  const [stepForm, setStepForm] = useState({
    title: '',
    assignedRole: 'hr',
    category: 'documents',
    dueDaysOffset: 3,
  });

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/templates');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load templates');
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/onboarding/templates/${id}`);
    const data = await res.json();
    if (res.ok) setDetail(data);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function createTemplate() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), type: newType, isDefault: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setNewName('');
      await loadList();
      setSelectedId(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function addStep() {
    if (!selectedId || !stepForm.title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/onboarding/templates/${selectedId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...stepForm,
          order: (detail?.steps.length ?? 0) + 1,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add step');
      }
      setStepForm((f) => ({ ...f, title: '' }));
      await loadDetail(selectedId);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add step');
    } finally {
      setBusy(false);
    }
  }

  async function deleteStep(stepId: string) {
    if (!selectedId || !confirm('Remove this step?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/onboarding/templates/${selectedId}/steps/${stepId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete step');
      await loadDetail(selectedId);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete step');
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate() {
    if (!selectedId || !confirm('Delete this template? This cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/onboarding/templates/${selectedId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setSelectedId(null);
      setDetail(null);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function setDefaultTemplate() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/onboarding/templates/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) throw new Error('Failed to set default');
      await loadList();
      await loadDetail(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set default');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardPage>
      <Link href="/dashboard/onboarding" className="mb-3 inline-flex items-center gap-1 text-sm text-primary-700 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Onboarding
      </Link>
      <DashboardPageHeader
        title="Onboarding templates"
        description="Configure checklist steps for onboarding and offboarding workflows."
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="dashboard-surface shadow-sm p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Templates</h2>
          {loading ? (
            <p className="mt-4 text-sm text-neutral-500">Loading…</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedId === t.id ? 'bg-primary-50 text-primary-900' : 'hover:bg-neutral-50'}`}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-xs text-neutral-500">
                      {t.type}{t.isDefault ? ' · default' : ''} · {t._count.steps} steps
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 border-t border-neutral-100 pt-4 space-y-2">
            <input
              className={`${dashboardFilterSelectClass} w-full`}
              placeholder="New template name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select className={`${dashboardFilterSelectClass} w-full`} value={newType} onChange={(e) => setNewType(e.target.value)}>
              <option value="ONBOARDING">Onboarding</option>
              <option value="OFFBOARDING">Offboarding</option>
            </select>
            <button type="button" disabled={busy} className="btn-primary w-full" onClick={() => void createTemplate()}>
              <Plus className="mr-1 inline h-4 w-4" />
              Create template
            </button>
          </div>
        </div>

        <div className="dashboard-surface shadow-sm p-4">
          {!detail ? (
            <p className="text-sm text-neutral-500">Select a template to edit steps.</p>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-neutral-900">{detail.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-xs text-neutral-500">
                  {detail.type} · used in {detail._count.workflows} workflows
                  {detail.isDefault ? ' · default template' : ''}
                </p>
                {!detail.isDefault ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="text-xs text-primary-700 hover:underline"
                    onClick={() => void setDefaultTemplate()}
                  >
                    Set as default
                  </button>
                ) : null}
                {detail._count.workflows === 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex items-center gap-1 text-xs text-red-700 hover:underline"
                    onClick={() => void deleteTemplate()}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete template
                  </button>
                ) : null}
              </div>
              <ol className="mt-4 space-y-2">
                {detail.steps.map((step) => (
                  <li key={step.id} className="flex items-start justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{step.order}. {step.title}</div>
                      <div className="text-xs text-neutral-500">
                        {step.assignedRole} · {step.category ?? '—'} · due +{step.dueDaysOffset}d
                        {step.isRequired ? ' · required' : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      className="text-neutral-400 hover:text-red-600"
                      aria-label="Delete step"
                      onClick={() => void deleteStep(step.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>
              <div className="mt-4 border-t border-neutral-100 pt-4 space-y-2">
                <input
                  className={`${dashboardFilterSelectClass} w-full`}
                  placeholder="Step title"
                  value={stepForm.title}
                  onChange={(e) => setStepForm((f) => ({ ...f, title: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className={dashboardFilterSelectClass}
                    value={stepForm.assignedRole}
                    onChange={(e) => setStepForm((f) => ({ ...f, assignedRole: e.target.value }))}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <input
                    className={dashboardFilterSelectClass}
                    placeholder="Category"
                    value={stepForm.category}
                    onChange={(e) => setStepForm((f) => ({ ...f, category: e.target.value }))}
                  />
                </div>
                <button type="button" disabled={busy} className="btn-secondary w-full" onClick={() => void addStep()}>
                  {busy ? <Loader2 className="inline h-4 w-4 animate-spin" /> : 'Add step'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardPage>
  );
}
