'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Scale, Loader2, AlertCircle, FileSignature, BadgeCheck } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type Obligation = {
  id: string;
  source: 'contract' | 'credential';
  title: string;
  party: string;
  dueDate: string;
  status: 'overdue' | 'due_soon' | 'ok';
  owner: string | null;
  href: string;
};

export default function LegalObligationsPage() {
  const [rows, setRows] = useState<Obligation[]>([]);
  const [summary, setSummary] = useState({ total: 0, overdue: 0, dueSoon: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/legal/obligations', { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data;
      })
      .then((data) => {
        setRows(data.obligations ?? []);
        setSummary(data.summary ?? { total: 0, overdue: 0, dueSoon: 0 });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Scale}
        title="Obligations register"
        description="Contract renewals and credential expiries in one compliance calendar."
      />

      <div className="flex flex-wrap gap-2 mb-6 text-sm">
        <Link href="/dashboard/people/contracts" className="btn-secondary inline-flex items-center gap-2">
          <FileSignature className="w-4 h-4" /> Contracts
        </Link>
        <Link href="/dashboard/credentials" className="btn-secondary inline-flex items-center gap-2">
          <BadgeCheck className="w-4 h-4" /> Credentials
        </Link>
        <Link href="/dashboard/company-documents" className="btn-secondary inline-flex items-center gap-2">
          Company policies
        </Link>
      </div>

      {!loading && !error && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="dashboard-stat-card">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Total</p>
            <p className="text-xl font-bold text-primary-900">{summary.total}</p>
          </div>
          <div className="dashboard-stat-card">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Due ≤ 60 days</p>
            <p className="text-xl font-bold text-amber-700">{summary.dueSoon}</p>
          </div>
          <div className="dashboard-stat-card">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Overdue</p>
            <p className="text-xl font-bold text-red-700">{summary.overdue}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading obligations…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="dashboard-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="dashboard-toolbar text-left">
                <th className="px-3 py-2.5">Due</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Obligation</th>
                <th className="px-3 py-2.5">Party</th>
                <th className="px-3 py-2.5">Owner</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                    No obligations tracked yet. Add contracts with end dates or employee credentials with expiry dates.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-neutral-100 hover:bg-primary-50/20">
                    <td className="px-3 py-2.5 tabular-nums">{row.dueDate}</td>
                    <td className="px-3 py-2.5 capitalize">{row.source}</td>
                    <td className="px-3 py-2.5">
                      <Link href={row.href} className="font-medium text-primary-900 hover:underline">
                        {row.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-neutral-600">{row.party}</td>
                    <td className="px-3 py-2.5 text-neutral-600">{row.owner ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          row.status === 'overdue'
                            ? 'bg-red-50 text-red-800'
                            : row.status === 'due_soon'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {row.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPage>
  );
}
