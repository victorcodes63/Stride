'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, Coins, Loader2, Plus, Send, SlidersHorizontal } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { SalesChartCard, SalesEmptyState, SALES_CHART } from '@/components/dashboard/sales';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';
import { StrideSelect } from '@/components/ui/stride-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import {
  computeCommissionFromAttainment,
  type CommissionRuleConfig,
} from '@/lib/sales/commission';
import { formatCompactCurrency, formatPercent, formatSalesCurrency } from '@/lib/sales/format';
import {
  apiFetch,
  salesKeys,
  useSalesMutation,
  useSalesResource,
} from '@/lib/sales/hooks';

type Estimate = {
  employeeId: string;
  employeeName?: string;
  attainmentPct: number | null;
  revenue: number;
  commissionAmount: number;
  currency: string;
  ruleName: string;
  payrollStatus?: string | null;
  alreadyPushed?: boolean;
  payrollId?: string | null;
};

type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  config: CommissionRuleConfig | null;
};

type CommissionsResponse = {
  estimates: Estimate[];
  rules: RuleRow[];
  canPushToPayroll: boolean;
  canManageRules: boolean;
  periodStart: string;
  periodEnd: string;
};

type PushResult = {
  pushed: Array<{ employeeId: string; payrollId: string; amount: number }>;
  skipped: Array<{ employeeId: string; reason: string }>;
  month: number;
  year: number;
};

function eligibleIds(rows: Estimate[]) {
  return rows.filter((e) => e.commissionAmount > 0 && !e.alreadyPushed).map((e) => e.employeeId);
}

function payrollStatusLabel(status: string | null | undefined) {
  if (!status) return 'none';
  return status.replace(/_/g, ' ');
}

export default function SalesCommissionsContent() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmPush, setConfirmPush] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);

  const query = useSalesResource<CommissionsResponse>(
    salesKeys.commissions(),
    '/api/sales/commissions',
  );
  const data = query.data;
  const estimates = data?.estimates ?? [];
  const rules = data?.rules ?? [];
  const canPushToPayroll = data?.canPushToPayroll === true;
  const canManageRules = data?.canManageRules === true;
  const activeRule = rules.find((r) => r.status === 'active') ?? null;

  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of estimates) map[e.employeeId] = e.employeeName ?? e.employeeId.slice(0, 8);
    return map;
  }, [estimates]);

  useEffect(() => {
    setSelectedIds(eligibleIds(estimates));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushMutation = useSalesMutation<{ result: PushResult }, string[]>(
    (employeeIds) =>
      apiFetch('/api/sales/commissions', {
        method: 'POST',
        body: JSON.stringify({ action: 'push_to_payroll', employeeIds }),
      }),
    {
      invalidateKeys: [salesKeys.all],
      onSuccess: (res) => {
        setPushResult(res.result);
        setConfirmPush(false);
        const pushed = res.result.pushed.length;
        const skipped = res.result.skipped.length;
        if (pushed > 0) {
          toast.success(`Pushed ${pushed} commission${pushed === 1 ? '' : 's'} to payroll.`);
        } else {
          toast.warning(`Nothing pushed. ${skipped} skipped.`);
        }
      },
    },
  );

  function toggleOne(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const eligible = eligibleIds(estimates);
  const allEligibleSelected =
    eligible.length > 0 && eligible.every((id) => selectedIds.includes(id));

  function toggleAll() {
    setSelectedIds(allEligibleSelected ? [] : eligible);
  }

  const totalSelected = useMemo(
    () =>
      estimates
        .filter((e) => selectedIds.includes(e.employeeId))
        .reduce((sum, e) => sum + e.commissionAmount, 0),
    [estimates, selectedIds],
  );

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Commissions"
        description="Model incentive payouts, review estimates from attainment tiers, and push to draft payroll."
        icon={Coins}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canManageRules ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-3 py-2 text-sm font-medium text-[var(--dash-text-strong)]"
              >
                <Plus className="h-4 w-4" /> New rule
              </button>
            ) : null}
            {canPushToPayroll ? (
              <button
                type="button"
                disabled={pushMutation.isPending || selectedIds.length === 0}
                onClick={() => setConfirmPush(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {pushMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Push to payroll
                {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
              </button>
            ) : null}
          </div>
        }
      />

      {query.isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {query.error?.message ?? 'Failed to load commissions.'}
        </div>
      ) : null}

      {query.isLoading ? (
        <div className="space-y-4">
          <div className={`${DASHBOARD_SURFACE_CLASS} h-96 animate-pulse`} />
          <div className={`${DASHBOARD_SURFACE_CLASS} h-64 animate-pulse`} />
        </div>
      ) : (
        <>
          <CommissionSimulator rules={rules} activeRule={activeRule} />

          {pushResult ? (
            <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-4 py-3 text-sm text-[var(--dash-text-strong)]">
              Pushed {pushResult.pushed.length} to payroll ({pushResult.year}-
              {String(pushResult.month).padStart(2, '0')}). Skipped {pushResult.skipped.length}.
              {pushResult.skipped.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-[var(--dash-text-muted)]">
                  {pushResult.skipped.slice(0, 8).map((s) => (
                    <li key={`${s.employeeId}-${s.reason}`}>
                      {nameById[s.employeeId] ?? s.employeeId.slice(0, 8)} — {s.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {estimates.length === 0 ? (
            <SalesEmptyState
              icon={Coins}
              title="No estimates yet"
              description={
                activeRule
                  ? 'Need closed revenue against approved targets for the period. Use the simulator above to model payouts in the meantime.'
                  : 'Create and activate a commission rule, then close deals against quotas.'
              }
              action={
                canManageRules && !activeRule ? (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
                  >
                    <Plus className="h-4 w-4" /> Create commission rule
                  </button>
                ) : (
                  <Link
                    href="/dashboard/sales/attainment"
                    className="text-sm font-medium text-[var(--stride-coral)]"
                  >
                    View attainment →
                  </Link>
                )
              }
            />
          ) : (
            <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dash-border)] px-4 py-3">
                <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">
                  Period estimates
                </h2>
                {selectedIds.length > 0 ? (
                  <span className="text-xs text-[var(--dash-text-muted)]">
                    {selectedIds.length} selected ·{' '}
                    <span className="font-semibold text-[var(--stride-coral)]">
                      {formatSalesCurrency(totalSelected, estimates[0]?.currency ?? 'KES')}
                    </span>
                  </span>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                    <tr>
                      <th className="px-4 py-3">
                        {canPushToPayroll ? (
                          <input
                            type="checkbox"
                            checked={allEligibleSelected}
                            onChange={toggleAll}
                            aria-label="Select all eligible reps"
                            className="rounded border-[var(--dash-border)]"
                          />
                        ) : null}
                      </th>
                      <th className="px-4 py-3">Rep</th>
                      <th className="px-4 py-3">Attainment</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Commission</th>
                      <th className="px-4 py-3">Payroll status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.map((e) => {
                      const checked = selectedIds.includes(e.employeeId);
                      const status = payrollStatusLabel(e.payrollStatus);
                      return (
                        <tr key={e.employeeId} className="border-t border-[var(--dash-border)] hover:bg-[var(--dash-hover)]">
                          <td className="px-4 py-3">
                            {canPushToPayroll ? (
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={e.commissionAmount <= 0 || e.alreadyPushed}
                                onChange={() => toggleOne(e.employeeId)}
                                aria-label={`Select ${e.employeeName ?? e.employeeId}`}
                                className="rounded border-[var(--dash-border)] disabled:opacity-40"
                              />
                            ) : null}
                          </td>
                          <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">
                            {e.employeeName ?? e.employeeId.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 tabular-nums">{formatPercent(e.attainmentPct)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatSalesCurrency(e.revenue, e.currency)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--stride-coral)]">
                            {formatSalesCurrency(e.commissionAmount, e.currency)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex flex-wrap items-center gap-1.5 capitalize">
                              {status}
                              {e.alreadyPushed ? (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                  pushed
                                </span>
                              ) : null}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {createOpen ? (
        <CreateCommissionRuleModal onClose={() => setCreateOpen(false)} onCreated={() => setCreateOpen(false)} />
      ) : null}

      <ConfirmDialog
        open={confirmPush}
        title="Push commissions to payroll?"
        description={
          <>
            This adds a &ldquo;Sales commission&rdquo; allowance to{' '}
            <strong>{selectedIds.length}</strong> draft payroll record
            {selectedIds.length === 1 ? '' : 's'} totalling{' '}
            <strong>{formatSalesCurrency(totalSelected, estimates[0]?.currency ?? 'KES')}</strong>{' '}
            and recomputes statutory deductions. Reps without a draft payroll are skipped.
          </>
        }
        confirmLabel="Push to payroll"
        loading={pushMutation.isPending}
        onConfirm={() => pushMutation.mutate(selectedIds)}
        onCancel={() => setConfirmPush(false)}
      />
    </DashboardPage>
  );
}

function CommissionSimulator({
  rules,
  activeRule,
}: {
  rules: RuleRow[];
  activeRule: RuleRow | null;
}) {
  const usableRules = useMemo(() => rules.filter((r) => r.config != null), [rules]);
  const [ruleId, setRuleId] = useState('');
  const [quota, setQuota] = useState(5_000_000);
  const [attainmentPct, setAttainmentPct] = useState(100);

  const selectedRule =
    usableRules.find((r) => r.id === ruleId) ?? activeRule ?? usableRules[0] ?? null;
  const config = selectedRule?.config ?? null;

  const revenue = Math.round((quota * attainmentPct) / 100);
  const payout = config ? computeCommissionFromAttainment(attainmentPct, revenue, config) : 0;
  const effectiveRate = revenue > 0 ? Math.round((payout / revenue) * 10000) / 100 : 0;

  const appliedTier = useMemo(() => {
    if (!config) return null;
    const sorted = [...config.tiers].sort((a, b) => b.minAttainmentPct - a.minAttainmentPct);
    return sorted.find((t) => attainmentPct >= t.minAttainmentPct) ?? sorted[sorted.length - 1] ?? null;
  }, [config, attainmentPct]);

  const acceleratorActive =
    config?.acceleratorAbovePct != null &&
    config.acceleratorMultiplier != null &&
    attainmentPct >= config.acceleratorAbovePct;
  const capActive = config?.capAmount != null && payout >= config.capAmount;

  const series = useMemo(() => {
    if (!config) return [];
    const points: Array<{ pct: number; payout: number }> = [];
    for (let pct = 0; pct <= 200; pct += 5) {
      const rev = (quota * pct) / 100;
      points.push({ pct, payout: computeCommissionFromAttainment(pct, rev, config) });
    }
    return points;
  }, [config, quota]);

  const tierMarks = useMemo(
    () => (config ? [...config.tiers].map((t) => t.minAttainmentPct).filter((p) => p > 0 && p <= 200) : []),
    [config],
  );

  return (
    <SalesChartCard
      title="Commission simulator"
      icon={SlidersHorizontal}
      height={340}
      isEmpty={config == null}
      emptyLabel="Create a commission rule to model payouts."
      action={
        usableRules.length > 0 ? (
          <StrideSelect
            value={selectedRule?.id ?? ''}
            onChange={setRuleId}
            options={usableRules.map((r) => ({
              value: r.id,
              label: r.status === 'active' ? `${r.name} (active)` : r.name,
            }))}
            ariaLabel="Commission rule"
            size="sm"
            className="w-52"
          />
        ) : undefined
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="space-y-4">
          <label className="block text-xs font-medium text-[var(--dash-text-muted)]">
            Quota (KES)
            <input
              type="number"
              min={0}
              value={quota}
              onChange={(e) => setQuota(Math.max(0, Number(e.target.value) || 0))}
              className="dash-auth-input mt-1 w-full"
            />
          </label>

          <div>
            <div className="flex items-center justify-between text-xs font-medium text-[var(--dash-text-muted)]">
              <span>Attainment</span>
              <span className="tabular-nums text-[var(--dash-text-strong)]">{attainmentPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              step={1}
              value={attainmentPct}
              onChange={(e) => setAttainmentPct(Number(e.target.value))}
              aria-label="Attainment percent"
              className="mt-2 w-full accent-[var(--stride-coral)]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[var(--dash-text-muted)]">
              <span>0%</span>
              <span>100%</span>
              <span>200%</span>
            </div>
          </div>

          <label className="block text-xs font-medium text-[var(--dash-text-muted)]">
            Closed revenue (KES)
            <input
              type="number"
              min={0}
              value={revenue}
              onChange={(e) => {
                const rev = Math.max(0, Number(e.target.value) || 0);
                setAttainmentPct(quota > 0 ? Math.round((rev / quota) * 100) : 0);
              }}
              className="dash-auth-input mt-1 w-full"
            />
          </label>

          <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]">
              Estimated payout
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--stride-coral)]">
              {formatSalesCurrency(payout, 'KES')}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-muted)]">
              <span>Effective rate: <strong className="text-[var(--dash-text-strong)]">{effectiveRate}%</strong></span>
              {appliedTier ? (
                <span>
                  Tier: <strong className="text-[var(--dash-text-strong)]">{appliedTier.minAttainmentPct}%+ @ {appliedTier.ratePct}%</strong>
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {acceleratorActive ? (
                <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                  Accelerator ×{config?.acceleratorMultiplier}
                </span>
              ) : null}
              {capActive ? (
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  Cap reached
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={series} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <XAxis
                dataKey="pct"
                type="number"
                domain={[0, 200]}
                ticks={[0, 50, 100, 150, 200]}
                tick={SALES_CHART.axisTick}
                tickLine={false}
                axisLine={{ stroke: SALES_CHART.gridStroke }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                tick={SALES_CHART.axisTick}
                tickLine={false}
                axisLine={{ stroke: SALES_CHART.gridStroke }}
                tickFormatter={(v) => formatCompactCurrency(Number(v), 'KES')}
                width={64}
              />
              <Tooltip
                cursor={{ stroke: SALES_CHART.gridStroke }}
                formatter={(value) => [formatSalesCurrency(Number(value), 'KES'), 'Payout']}
                labelFormatter={(label) => `${label}% attainment`}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid var(--dash-border)',
                  background: 'var(--dash-surface-solid)',
                  fontSize: 12,
                }}
              />
              {tierMarks.map((mark) => (
                <ReferenceLine
                  key={mark}
                  x={mark}
                  stroke={SALES_CHART.gridStroke}
                  strokeDasharray="3 3"
                  label={{ value: `${mark}%`, position: 'top', fill: 'var(--dash-text-muted)', fontSize: 10 }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="payout"
                stroke={SALES_CHART.coral}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
              <ReferenceDot
                x={attainmentPct}
                y={payout}
                r={5}
                fill={SALES_CHART.coral}
                stroke="var(--dash-surface-solid)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-center text-xs text-[var(--dash-text-muted)]">
            Payout across attainment for a {formatCompactCurrency(quota, 'KES')} quota. Dashed lines mark tier thresholds.
          </p>
        </div>
      </div>
    </SalesChartCard>
  );
}

function CreateCommissionRuleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('Standard commission tiers');
  const [description, setDescription] = useState('');
  const [tier0, setTier0] = useState('2');
  const [tier80, setTier80] = useState('3.5');
  const [tier100, setTier100] = useState('5');
  const [capAmount, setCapAmount] = useState('');
  const [acceleratorAbovePct, setAcceleratorAbovePct] = useState('120');
  const [acceleratorMultiplier, setAcceleratorMultiplier] = useState('1.15');
  const [activate, setActivate] = useState(true);

  const createMutation = useSalesMutation<unknown, void>(
    () => {
      const config: CommissionRuleConfig = {
        tiers: [
          { minAttainmentPct: 0, ratePct: Number(tier0) },
          { minAttainmentPct: 80, ratePct: Number(tier80) },
          { minAttainmentPct: 100, ratePct: Number(tier100) },
        ],
      };
      if (capAmount.trim() && Number(capAmount) > 0) config.capAmount = Number(capAmount);
      if (acceleratorAbovePct.trim() && acceleratorMultiplier.trim() && Number(acceleratorMultiplier) > 0) {
        config.acceleratorAbovePct = Number(acceleratorAbovePct);
        config.acceleratorMultiplier = Number(acceleratorMultiplier);
      }
      return apiFetch('/api/sales/commissions', {
        method: 'POST',
        body: JSON.stringify({ name, description: description || undefined, config, activate }),
      });
    },
    {
      invalidateKeys: [salesKeys.all],
      onSuccess: () => {
        toast.success(activate ? 'Commission rule created and activated.' : 'Commission rule saved.');
        onCreated();
      },
    },
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-[var(--dash-text-strong)]">New commission rule</h2>
        <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
          Rates apply to closed revenue. Activating archives any previous active rule.
        </p>
        <label className="mt-4 block text-xs text-[var(--dash-text-muted)]">
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} className="dash-auth-input mt-1 w-full" />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="dash-auth-input mt-1 w-full" />
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <label className="block text-xs text-[var(--dash-text-muted)]">
            0%+ rate
            <input required type="number" min={0} step="0.1" value={tier0} onChange={(e) => setTier0(e.target.value)} className="dash-auth-input mt-1 w-full" />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            80%+ rate
            <input required type="number" min={0} step="0.1" value={tier80} onChange={(e) => setTier80(e.target.value)} className="dash-auth-input mt-1 w-full" />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            100%+ rate
            <input required type="number" min={0} step="0.1" value={tier100} onChange={(e) => setTier100(e.target.value)} className="dash-auth-input mt-1 w-full" />
          </label>
        </div>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Cap amount (KES, optional)
          <input type="number" min={0} value={capAmount} onChange={(e) => setCapAmount(e.target.value)} placeholder="e.g. 500000" className="dash-auth-input mt-1 w-full" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Accelerator above %
            <input type="number" min={0} value={acceleratorAbovePct} onChange={(e) => setAcceleratorAbovePct(e.target.value)} className="dash-auth-input mt-1 w-full" />
          </label>
          <label className="block text-xs text-[var(--dash-text-muted)]">
            Accelerator ×
            <input type="number" min={0} step="0.01" value={acceleratorMultiplier} onChange={(e) => setAcceleratorMultiplier(e.target.value)} className="dash-auth-input mt-1 w-full" />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-[var(--dash-text-strong)]">
          <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} className="rounded border-[var(--dash-border)]" />
          Activate immediately
        </label>
        {createMutation.isError ? (
          <p className="mt-3 text-xs text-red-600">{createMutation.error?.message ?? 'Create failed'}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create rule
          </button>
        </div>
      </form>
    </div>
  );
}
