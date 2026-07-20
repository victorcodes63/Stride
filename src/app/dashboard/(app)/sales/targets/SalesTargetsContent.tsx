'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Plus, Target, Users } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatGrid, DashboardMetricCard } from '@/components/dashboard/DashboardStatGrid';
import { SalesEmptyState } from '@/components/dashboard/sales';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';
import { StrideSelect } from '@/components/ui/stride-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { formatPercent, formatSalesCurrency, formatShortDate } from '@/lib/sales/format';
import {
  apiFetch,
  salesKeys,
  useSalesMutation,
  useSalesResource,
} from '@/lib/sales/hooks';

type TargetRow = {
  id: string;
  employeeId: string | null;
  departmentId: string | null;
  employee: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  status: string;
};

type AttainmentRep = {
  employeeId: string;
  employeeName: string;
  actual: number;
  target: number;
  attainmentPct: number | null;
};

type TargetsResponse = { targets: TargetRow[] };
type AttainmentResponse = { report?: { leaderboard?: AttainmentRep[] } };
type MeResponse = { canManageSalesTargets?: boolean };

const STATUS_TONE: Record<string, string> = {
  draft:
    'bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)] border border-[var(--dash-border)]',
  pending_approval:
    'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
  approved:
    'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
};

function attainmentTone(pct: number | null) {
  if (pct == null) return 'bg-neutral-300 dark:bg-neutral-600';
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-[var(--stride-coral)]';
  return 'bg-amber-500';
}

function AttainmentBar({ pct, actual, currency }: { pct: number | null; actual: number | null; currency: string }) {
  const width = pct != null ? Math.min(100, Math.max(0, pct)) : 0;
  return (
    <div className="min-w-[10rem]">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--dash-text-strong)] tabular-nums">
          {formatPercent(pct)}
        </span>
        {actual != null ? (
          <span className="text-[var(--dash-text-muted)]">
            {formatSalesCurrency(actual, currency)} closed
          </span>
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--dash-surface-muted)]">
        <div className={`h-full rounded-full ${attainmentTone(pct)}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function SalesTargetsContent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<TargetRow | null>(null);

  const targetsQuery = useSalesResource<TargetsResponse>(salesKeys.targets(), '/api/sales/targets');
  const attainmentQuery = useSalesResource<AttainmentResponse>(
    salesKeys.attainment(),
    '/api/sales/attainment',
  );
  const meQuery = useSalesResource<MeResponse>(['auth-me'], '/api/auth/me');

  const canManage = meQuery.data?.canManageSalesTargets === true;
  const targets = targetsQuery.data?.targets ?? [];

  const attainmentByEmployee = useMemo(() => {
    const map = new Map<string, AttainmentRep>();
    for (const row of attainmentQuery.data?.report?.leaderboard ?? []) {
      map.set(row.employeeId, row);
    }
    return map;
  }, [attainmentQuery.data]);

  const teamTotals = useMemo(() => {
    const approved = targets.filter((t) => t.status === 'approved');
    const quota = approved.reduce((sum, t) => sum + t.amount, 0);
    let closed = 0;
    for (const t of approved) {
      if (t.employeeId) {
        const att = attainmentByEmployee.get(t.employeeId);
        if (att) closed += att.actual;
      }
    }
    const pct = quota > 0 ? Math.round((closed / quota) * 1000) / 10 : null;
    const currency = targets[0]?.currency ?? 'KES';
    return { quota, closed, pct, currency, count: targets.length, approvedCount: approved.length };
  }, [targets, attainmentByEmployee]);

  const approveMutation = useSalesMutation<unknown, string>(
    (id) => apiFetch(`/api/sales/targets/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'approve' }) }),
    {
      invalidateKeys: [salesKeys.all],
      onSuccess: () => {
        toast.success('Target approved.');
        setApproveTarget(null);
      },
    },
  );

  const loading = targetsQuery.isLoading || meQuery.isLoading;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Sales targets"
        description="Set and approve quotas per rep or team, and track attainment for the current period."
        icon={Target}
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> New target
            </button>
          ) : undefined
        }
      />

      {targetsQuery.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {targetsQuery.error?.message ?? 'Failed to load targets.'}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`${DASHBOARD_SURFACE_CLASS} h-24 animate-pulse`} />
            ))}
          </div>
          <div className={`${DASHBOARD_SURFACE_CLASS} h-72 animate-pulse`} />
        </div>
      ) : targets.length === 0 ? (
        <SalesEmptyState
          icon={Target}
          title="No quotas yet"
          description="Create a target for this period, or seed demo sales data."
          action={
            canManage ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
              >
                <Plus className="h-4 w-4" /> Create target
              </button>
            ) : (
              <Link
                href="/dashboard/sales"
                className="text-sm font-medium text-[var(--stride-coral)]"
              >
                Back to sales overview →
              </Link>
            )
          }
        />
      ) : (
        <>
          <DashboardStatGrid columns={3}>
            <DashboardMetricCard
              label="Approved quota"
              value={formatSalesCurrency(teamTotals.quota, teamTotals.currency)}
              hint={`${teamTotals.approvedCount} approved · ${teamTotals.count} total`}
              icon={Target}
              tone="primary"
            />
            <DashboardMetricCard
              label="Closed to date"
              value={formatSalesCurrency(teamTotals.closed, teamTotals.currency)}
              icon={CheckCircle2}
              tone="emerald"
            />
            <DashboardMetricCard
              label="Team attainment"
              value={formatPercent(teamTotals.pct)}
              hint="Across approved quotas"
              icon={Users}
              tone={teamTotals.pct != null && teamTotals.pct >= 100 ? 'emerald' : 'amber'}
            />
          </DashboardStatGrid>

          <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Rep / team</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3 text-right">Quota</th>
                    <th className="px-4 py-3">Attainment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t) => {
                    const name = t.employee?.name ?? t.department?.name ?? '—';
                    const att = t.employeeId ? attainmentByEmployee.get(t.employeeId) : undefined;
                    const pct = att?.attainmentPct ?? null;
                    return (
                      <tr key={t.id} className="border-t border-[var(--dash-border)] hover:bg-[var(--dash-hover)]">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--dash-text-strong)]">{name}</div>
                          <div className="text-xs text-[var(--dash-text-muted)]">
                            {t.department && t.employee ? t.department.name : t.employeeId ? 'Rep quota' : 'Team quota'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--dash-text-muted)]">
                          <span className="capitalize">{t.periodType}</span>
                          <div className="text-xs">
                            {formatShortDate(t.periodStart)} → {formatShortDate(t.periodEnd)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--dash-text-strong)]">
                          {formatSalesCurrency(t.amount, t.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <AttainmentBar pct={pct} actual={att?.actual ?? null} currency={t.currency} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                              STATUS_TONE[t.status] ?? STATUS_TONE.draft
                            }`}
                          >
                            {t.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {t.status === 'pending_approval' && canManage ? (
                            <button
                              type="button"
                              onClick={() => setApproveTarget(t)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[var(--stride-coral)] px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--dash-border)] bg-[var(--dash-surface-muted)] font-semibold">
                    <td className="px-4 py-3 text-[var(--dash-text-strong)]" colSpan={2}>
                      Team total (approved)
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--dash-text-strong)]">
                      {formatSalesCurrency(teamTotals.quota, teamTotals.currency)}
                    </td>
                    <td className="px-4 py-3" colSpan={3}>
                      <AttainmentBar pct={teamTotals.pct} actual={teamTotals.closed} currency={teamTotals.currency} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {createOpen ? (
        <CreateTargetModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => setCreateOpen(false)}
        />
      ) : null}

      <ConfirmDialog
        open={approveTarget != null}
        title="Approve sales target?"
        description={
          approveTarget ? (
            <>
              Approve the {approveTarget.periodType} quota of{' '}
              <strong>{formatSalesCurrency(approveTarget.amount, approveTarget.currency)}</strong> for{' '}
              <strong>{approveTarget.employee?.name ?? approveTarget.department?.name ?? 'this owner'}</strong>?
              This locks the quota and syncs attainment metrics.
            </>
          ) : null
        }
        confirmLabel="Approve"
        loading={approveMutation.isPending}
        onConfirm={() => approveTarget && approveMutation.mutate(approveTarget.id)}
        onCancel={() => setApproveTarget(null)}
      />
    </DashboardPage>
  );
}

function CreateTargetModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const repsQuery = useSalesResource<{ employees: Array<{ id: string; name: string }> }>(
    salesKeys.reps(),
    '/api/sales/reps',
  );
  const employees = repsQuery.data?.employees ?? [];

  const [employeeId, setEmployeeId] = useState('');
  const [periodType, setPeriodType] = useState<'month' | 'quarter' | 'year'>('month');
  const [amount, setAmount] = useState('5000000');
  const [periodStart, setPeriodStart] = useState('');
  const [submitForApproval, setSubmitForApproval] = useState(true);
  const [notes, setNotes] = useState('');

  const effectiveEmployeeId = employeeId || employees[0]?.id || '';

  const createMutation = useSalesMutation<unknown, void>(
    () =>
      apiFetch('/api/sales/targets', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: effectiveEmployeeId,
          periodType,
          amount: Number(amount),
          currency: 'KES',
          submitForApproval,
          ...(periodStart ? { periodStart } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      }),
    {
      invalidateKeys: [salesKeys.all],
      onSuccess: () => {
        toast.success(submitForApproval ? 'Target submitted for approval.' : 'Draft target created.');
        onCreated();
      },
    },
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveEmployeeId) return;
    createMutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-[var(--dash-text-strong)]">New sales target</h2>
        <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
          Set a quota for a rep. Submitting for approval locks it once a manager signs off.
        </p>
        <label className="mt-4 block text-xs text-[var(--dash-text-muted)]">
          Rep
          <StrideSelect
            value={effectiveEmployeeId}
            onChange={setEmployeeId}
            options={
              employees.length === 0
                ? [{ value: '', label: 'No active employees' }]
                : employees.map((e) => ({ value: e.id, label: e.name }))
            }
            ariaLabel="Rep"
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Period
          <StrideSelect
            value={periodType}
            onChange={(value) => setPeriodType(value as 'month' | 'quarter' | 'year')}
            options={[
              { value: 'month', label: 'Month' },
              { value: 'quarter', label: 'Quarter' },
              { value: 'year', label: 'Year' },
            ]}
            ariaLabel="Period"
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Anchor date (optional)
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
          <span className="mt-1 block text-[10px] text-[var(--dash-text-muted)]">
            Leave blank to use the current period.
          </span>
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Quota (KES)
          <input
            required
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-xs text-[var(--dash-text-strong)]">
          <input
            type="checkbox"
            checked={submitForApproval}
            onChange={(e) => setSubmitForApproval(e.target.checked)}
            className="rounded border-[var(--dash-border)]"
          />
          Submit for approval
        </label>
        {createMutation.isError ? (
          <p className="mt-3 text-xs text-red-600">
            {createMutation.error?.message ?? 'Create failed'}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || !effectiveEmployeeId}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
