'use client';

import { useCallback, useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SaccoMemberRegister, type SaccoMemberRow } from '@/components/sacco/SaccoMemberRegister';
import { DashboardAsyncState, DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';

type Member = SaccoMemberRow;

export default function SaccoMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', joinedAt: new Date().toISOString().slice(0, 10) });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sacco/members');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load members');
      setMembers(json.members ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/sacco/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create member');
      setForm({ firstName: '', lastName: '', joinedAt: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create member');
    } finally {
      setCreating(false);
    }
  }

  if (loading && members.length === 0) return <DashboardPageSkeleton />;

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="SACCO"
        title="Members"
        description="Member register with share, BOSA, and FOSA account balances."
      />

      <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4 sm:grid-cols-4">
        <input
          required
          placeholder="First name"
          value={form.firstName}
          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
          className="h-10 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <input
          required
          placeholder="Last name"
          value={form.lastName}
          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
          className="h-10 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <input
          required
          type="date"
          value={form.joinedAt}
          onChange={(e) => setForm((f) => ({ ...f, joinedAt: e.target.value }))}
          className="h-10 rounded-lg border border-neutral-200 px-3 text-sm"
        />
        <button
          type="submit"
          disabled={creating}
          className="h-10 rounded-lg bg-primary-500 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
        >
          {creating ? 'Adding…' : 'Add member'}
        </button>
      </form>

      {error ? (
        <DashboardAsyncState variant="error" title="Members" message={error} onRetry={() => void load()} />
      ) : (
        <SaccoMemberRegister members={members} />
      )}
    </DashboardPage>
  );
}
