'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FileText, Loader2, Plus } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardAsyncState, type DashboardAsyncStatus } from '@/components/dashboard/DashboardAsyncState';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { dashStatusChip } from '@/lib/dashboard-status-chips';

type FormTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  updatedAt: string;
  _count: { submissions: number; tasks: number; steps: number };
};

export default function OnboardingFormsPage() {
  const [rows, setRows] = useState<FormTemplateRow[]>([]);
  const [status, setStatus] = useState<DashboardAsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/onboarding/forms');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load forms');
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      setStatus(list.length ? 'success' : 'empty');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createForm() {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), fields: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setNewName('');
      window.location.href = `/dashboard/onboarding/forms/${data.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
      setBusy(false);
    }
  }

  return (
    <DashboardPage>
      <Link
        href="/dashboard/onboarding"
        className="mb-3 inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Onboarding
      </Link>
      <DashboardPageHeader
        title="Data-collection forms"
        description="Reusable forms employees complete during onboarding."
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="dashboard-surface mb-4 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900">New form</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className={`${dashboardFilterSelectClass} flex-1`}
            placeholder="Form name (e.g. New hire data form)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void createForm();
            }}
          />
          <button
            type="button"
            disabled={busy || !newName.trim()}
            className="btn-primary inline-flex items-center justify-center gap-1"
            onClick={() => void createForm()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create &amp; edit fields
          </button>
        </div>
      </div>

      <DashboardAsyncState
        status={status}
        error={error}
        onRetry={load}
        empty={
          <div className="dashboard-surface flex flex-col items-center gap-2 px-6 py-12 text-center">
            <FileText className="h-8 w-8 text-neutral-300" />
            <p className="text-sm font-medium text-neutral-700">No forms yet</p>
            <p className="max-w-sm text-sm text-neutral-500">
              Create your first data-collection form above.
            </p>
          </div>
        }
      >
        <div className="dashboard-surface overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200/80 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3 font-medium">Form</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submissions</th>
                <th className="px-4 py-3 font-medium">Used in steps</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/onboarding/forms/${row.id}`}
                      className="font-medium text-primary-700 hover:underline"
                    >
                      {row.name}
                    </Link>
                    {row.description ? (
                      <p className="mt-0.5 text-xs text-neutral-500">{row.description}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={dashStatusChip(row.isActive ? 'success' : 'neutral')}>
                      {row.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{row._count.submissions}</td>
                  <td className="px-4 py-3 text-neutral-700">{row._count.steps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardAsyncState>
    </DashboardPage>
  );
}
