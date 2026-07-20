'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';
import { StrideSelect } from '@/components/ui/stride-select';

type Account = {
  id: string;
  memberNumber: string | null;
  memberName: string | null;
  accountType: string;
  balance: number;
};

export default function SaccoAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({
    accountId: '',
    entryType: 'contribution',
    amount: '',
    entryDate: new Date().toISOString().slice(0, 10),
    description: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sacco/accounts');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load accounts');
      setAccounts(json.accounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    setPosting(true);
    try {
      const res = await fetch('/api/sacco/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to post entry');
      setForm((f) => ({ ...f, amount: '', description: '' }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post entry');
    } finally {
      setPosting(false);
    }
  }

  if (loading && accounts.length === 0) return <DashboardPageSkeleton />;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="SACCO"
        title="BOSA & FOSA ledger"
        description="Post contributions and withdrawals to member share, BOSA, and FOSA accounts."
      />

      <form onSubmit={handlePost} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 lg:grid-cols-6">
        <StrideSelect
          value={form.accountId}
          onChange={(value) => setForm((f) => ({ ...f, accountId: value }))}
          options={[
            { value: '', label: 'Select account' },
            ...accounts.map((a) => ({
              value: a.id,
              label: `${a.memberNumber} · ${a.accountType.toUpperCase()} · ${a.balance.toLocaleString()}`,
            })),
          ]}
          ariaLabel="Account"
          className="lg:col-span-2"
        />
        <StrideSelect
          value={form.entryType}
          onChange={(value) => setForm((f) => ({ ...f, entryType: value }))}
          options={[
            { value: 'contribution', label: 'Contribution' },
            { value: 'withdrawal', label: 'Withdrawal' },
            { value: 'interest', label: 'Interest' },
            { value: 'adjustment', label: 'Adjustment' },
          ]}
          ariaLabel="Entry type"
        />
        <input
          required
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          className="h-10 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <input
          required
          type="date"
          value={form.entryDate}
          onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))}
          className="h-10 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <button
          type="submit"
          disabled={posting}
          className="h-10 rounded-lg bg-primary-500 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
        >
          {posting ? 'Posting…' : 'Post entry'}
        </button>
      </form>

      {error ? (
        <DashboardAsyncState variant="error" title="Accounts" message={error} onRetry={() => void load()} />
      ) : (
        <DashboardTableCard title="All accounts">
          <DashboardTableViewport>
            <DashboardTable>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Type</th>
                  <th>Balance (KES)</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="font-mono text-xs">{a.memberNumber}</span>
                      <span className="ml-2">{a.memberName}</span>
                    </td>
                    <td className="uppercase">{a.accountType}</td>
                    <td>{a.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
            {accounts.length === 0 ? <DashboardTableEmpty message="No accounts yet." /> : null}
          </DashboardTableViewport>
        </DashboardTableCard>
      )}
    </DashboardPage>
  );
}
