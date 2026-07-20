'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  BarChart3,
  Coins,
  Flame,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UserSearch,
  XCircle,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';
import {
  LeadRatingBadge,
  SalesDrawer,
  SalesEmptyState,
  SalesFilterBar,
  SalesStageBadge,
  type FilterSelect,
} from '@/components/dashboard/sales';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { apiFetch, salesKeys, useSalesMutation, useSalesResource } from '@/lib/sales/hooks';
import {
  formatCompactCurrency,
  formatPercent,
  formatRelativeTime,
  formatSalesCurrency,
  formatShortDate,
} from '@/lib/sales/format';
import { scoreLead, type LeadScoreResult } from '@/lib/sales/lead-scoring';
import { SALES_LEAD_RATINGS, type SalesLeadRating } from '@/lib/sales/schema';

type Lead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  score: number;
  rating: SalesLeadRating;
  estimatedValue: number | null;
  lastActivityAt: string | null;
  notes: string | null;
  ownerEmployeeId: string | null;
  owner: { id: string; name: string } | null;
  convertedDealId: string | null;
  convertedDeal: { id: string; name: string; stage: string } | null;
  createdAt: string;
  updatedAt: string;
};

type Rep = { id: string; name: string; email: string | null };

type SortKey = 'score' | 'value' | 'recent';

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  qualified: 'Qualified',
  disqualified: 'Disqualified',
  converted: 'Converted',
};

const STATUS_TONE: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20',
  qualified:
    'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20',
  disqualified:
    'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20',
  converted:
    'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20',
};

const RATING_BAR: Record<SalesLeadRating, string> = {
  hot: 'bg-rose-500',
  warm: 'bg-amber-500',
  cold: 'bg-sky-500',
};

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.new;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ScoreBar({ score, rating, className = '' }: { score: number; rating: SalesLeadRating; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--dash-border)]">
        <div
          className={`h-full rounded-full ${RATING_BAR[rating] ?? RATING_BAR.cold}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
      <span className="w-6 text-right text-xs font-semibold tabular-nums text-[var(--dash-text-strong)]">
        {score}
      </span>
    </div>
  );
}

function ScoreBreakdown({ result }: { result: LeadScoreResult }) {
  return (
    <div className="space-y-2">
      {result.breakdown.map((b) => {
        const pct = b.max > 0 ? (b.points / b.max) * 100 : 0;
        return (
          <div key={b.label}>
            <div className="flex items-center justify-between text-[11px] text-[var(--dash-text-muted)]">
              <span>{b.label}</span>
              <span className="tabular-nums">
                {b.points}
                <span className="opacity-60">/{b.max}</span>
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--dash-border)]">
              <div
                className="h-full rounded-full bg-[var(--stride-coral)]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="dashboard-stat-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--dash-text-muted)]">
          {label}
        </p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--stride-coral)]/10 text-[var(--stride-coral)]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-[var(--dash-text-strong)]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--dash-text-muted)]">{hint}</p> : null}
    </div>
  );
}

export default function SalesLeadsContent() {
  const [sort, setSort] = useState<SortKey>('score');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formState, setFormState] = useState<{ mode: 'create' } | { mode: 'edit'; lead: Lead } | null>(
    null,
  );
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  const leadsQuery = useSalesResource<{ leads: Lead[] }>(
    salesKeys.leads({ sort }),
    `/api/sales/leads?sort=${sort}`,
  );
  const repsQuery = useSalesResource<{ employees: Rep[] }>(salesKeys.reps(), '/api/sales/reps');

  const leads = useMemo(() => leadsQuery.data?.leads ?? [], [leadsQuery.data]);
  const reps = repsQuery.data?.employees ?? [];

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId],
  );

  const convertMutation = useSalesMutation<{ deal?: { id: string } | null }, string>(
    (id) =>
      apiFetch(`/api/sales/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'convert' }),
      }),
    {
      onSuccess: () => toast.success('Lead converted to a deal.'),
    },
  );

  const statusMutation = useSalesMutation<unknown, { id: string; status: string }>(
    ({ id, status }) =>
      apiFetch(`/api/sales/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    {
      onSuccess: (_data, { status }) =>
        toast.success(
          status === 'disqualified' ? 'Lead disqualified.' : 'Lead moved back into play.',
        ),
    },
  );

  const deleteMutation = useSalesMutation<unknown, string>(
    (id) => apiFetch(`/api/sales/leads/${id}`, { method: 'DELETE' }),
    { onSuccess: () => toast.success('Lead deleted.') },
  );

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) if (l.source) set.add(l.source);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (ratingFilter && l.rating !== ratingFilter) return false;
      if (sourceFilter && (l.source ?? '') !== sourceFilter) return false;
      if (q) {
        const haystack = `${l.name} ${l.company ?? ''} ${l.email ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, statusFilter, ratingFilter, sourceFilter]);

  const kpis = useMemo(() => {
    const total = leads.length;
    const hot = leads.filter((l) => l.rating === 'hot').length;
    const avgScore = total ? Math.round(leads.reduce((s, l) => s + l.score, 0) / total) : 0;
    const pipeline = leads
      .filter((l) => l.status === 'new' || l.status === 'qualified')
      .reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
    const converted = leads.filter((l) => l.status === 'converted').length;
    const conversion = total ? (converted / total) * 100 : 0;
    return { total, hot, avgScore, pipeline, converted, conversion };
  }, [leads]);

  const sourceStats = useMemo(() => {
    const map = new Map<string, { count: number; converted: number; value: number }>();
    for (const l of leads) {
      const key = l.source?.trim() || 'Unknown';
      const entry = map.get(key) ?? { count: 0, converted: 0, value: 0 };
      entry.count += 1;
      if (l.status === 'converted') entry.converted += 1;
      entry.value += l.estimatedValue ?? 0;
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([source, s]) => ({ source, ...s, conversion: s.count ? (s.converted / s.count) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  const handleConvert = useCallback(async () => {
    if (!convertTarget) return;
    try {
      await convertMutation.mutateAsync(convertTarget.id);
      setConvertTarget(null);
      setSelectedId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Convert failed.');
    }
  }, [convertTarget, convertMutation]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed.');
    }
  }, [deleteTarget, deleteMutation]);

  const changeStatus = useCallback(
    async (lead: Lead, status: string) => {
      try {
        await statusMutation.mutateAsync({ id: lead.id, status });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Update failed.');
      }
    },
    [statusMutation],
  );

  const isLoading = leadsQuery.isLoading;
  const isError = leadsQuery.isError;

  const filterSelects: FilterSelect[] = [
    {
      id: 'status',
      value: statusFilter,
      ariaLabel: 'Filter by status',
      onChange: setStatusFilter,
      options: [
        { value: '', label: 'All statuses' },
        ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
      ],
    },
    {
      id: 'rating',
      value: ratingFilter,
      ariaLabel: 'Filter by rating',
      onChange: setRatingFilter,
      options: [
        { value: '', label: 'All ratings' },
        ...SALES_LEAD_RATINGS.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) })),
      ],
    },
    {
      id: 'source',
      value: sourceFilter,
      ariaLabel: 'Filter by source',
      onChange: setSourceFilter,
      options: [
        { value: '', label: 'All sources' },
        ...sources.map((s) => ({ value: s, label: s })),
      ],
    },
  ];

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Leads"
        description="Capture prospects, prioritise by score, and convert them into pipeline deals."
        icon={UserSearch}
        actions={
          <button
            type="button"
            onClick={() => setFormState({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Add lead
          </button>
        }
      />

      {isError ? (
        <SalesEmptyState
          icon={UserSearch}
          title="Couldn't load leads"
          description={leadsQuery.error?.message ?? 'Something went wrong. Please try again.'}
          action={
            <button
              type="button"
              onClick={() => void leadsQuery.refetch()}
              className="rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
            >
              Retry
            </button>
          }
        />
      ) : isLoading ? (
        <LeadsSkeleton />
      ) : leads.length === 0 ? (
        <SalesEmptyState
          icon={UserSearch}
          title="No leads yet"
          description="Add a prospect to start the funnel before the pipeline. Every lead is scored automatically so your team knows who to call first."
          action={
            <button
              type="button"
              onClick={() => setFormState({ mode: 'create' })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Create lead
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard icon={UserSearch} label="Total leads" value={String(kpis.total)} />
            <KpiCard
              icon={Flame}
              label="Hot leads"
              value={String(kpis.hot)}
              hint={kpis.total ? `${Math.round((kpis.hot / kpis.total) * 100)}% of leads` : undefined}
            />
            <KpiCard icon={Target} label="Avg score" value={`${kpis.avgScore}`} hint="out of 100" />
            <KpiCard
              icon={Coins}
              label="Pipeline value"
              value={formatCompactCurrency(kpis.pipeline)}
              hint="Open leads"
            />
            <KpiCard
              icon={TrendingUp}
              label="Conversion"
              value={formatPercent(kpis.conversion)}
              hint={`${kpis.converted} converted`}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <SalesFilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search name, company, or email…"
                selects={filterSelects}
                resultCount={filtered.length}
                right={
                  <label className="flex items-center gap-2 text-xs text-[var(--dash-text-muted)]">
                    Sort
                    <StrideSelect
                      value={sort}
                      onChange={(v) => setSort(v as SortKey)}
                      ariaLabel="Sort leads"
                      className="min-w-[9rem]"
                      options={[
                        { value: 'score', label: 'Highest score' },
                        { value: 'value', label: 'Highest value' },
                        { value: 'recent', label: 'Most recent' },
                      ]}
                    />
                  </label>
                }
              />

              {filtered.length === 0 ? (
                <SalesEmptyState
                  icon={UserSearch}
                  title="No matching leads"
                  description="Try clearing a filter or adjusting your search."
                  compact
                />
              ) : (
                <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                        <tr>
                          <th className="px-4 py-3">Lead</th>
                          <th className="px-4 py-3">Source</th>
                          <th className="px-4 py-3">Owner</th>
                          <th className="px-4 py-3">Est. value</th>
                          <th className="px-4 py-3">Score</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Last activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((lead) => (
                          <tr
                            key={lead.id}
                            onClick={() => setSelectedId(lead.id)}
                            className="cursor-pointer border-t border-[var(--dash-border)] hover:bg-[var(--dash-hover)]"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-[var(--dash-text-strong)]">
                                {lead.name}
                              </div>
                              <div className="text-xs text-[var(--dash-text-muted)]">
                                {lead.company ?? lead.email ?? '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[var(--dash-text-muted)]">
                              {lead.source ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-[var(--dash-text-muted)]">
                              {lead.owner?.name ?? '—'}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-[var(--dash-text-strong)]">
                              {lead.estimatedValue != null
                                ? formatSalesCurrency(lead.estimatedValue)
                                : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ScoreBar score={lead.score} rating={lead.rating} />
                                <LeadRatingBadge rating={lead.rating} />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill status={lead.status} />
                            </td>
                            <td className="px-4 py-3 text-xs text-[var(--dash-text-muted)]">
                              {formatRelativeTime(lead.lastActivityAt ?? lead.updatedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <SourceAnalyticsPanel stats={sourceStats} />
          </div>
        </div>
      )}

      <LeadDetailDrawer
        lead={selectedLead}
        open={Boolean(selectedLead)}
        onClose={() => setSelectedId(null)}
        onEdit={(lead) => {
          setSelectedId(null);
          setFormState({ mode: 'edit', lead });
        }}
        onConvert={(lead) => setConvertTarget(lead)}
        onDelete={(lead) => setDeleteTarget(lead)}
        onChangeStatus={changeStatus}
        statusPending={statusMutation.isPending}
      />

      {formState ? (
        <LeadFormDrawer
          key={formState.mode === 'edit' ? formState.lead.id : 'create'}
          mode={formState.mode}
          lead={formState.mode === 'edit' ? formState.lead : null}
          reps={reps}
          onClose={() => setFormState(null)}
          onSaved={() => setFormState(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(convertTarget)}
        title="Convert lead to deal?"
        description={
          convertTarget
            ? `A new qualified deal will be created for ${convertTarget.company || convertTarget.name}. The lead will be marked as converted.`
            : undefined
        }
        confirmLabel="Convert"
        loading={convertMutation.isPending}
        onConfirm={() => void handleConvert()}
        onCancel={() => setConvertTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete lead?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be permanently removed. This can't be undone.`
            : undefined
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </DashboardPage>
  );
}

function SourceAnalyticsPanel({
  stats,
}: {
  stats: Array<{ source: string; count: number; converted: number; value: number; conversion: number }>;
}) {
  const max = stats.reduce((m, s) => Math.max(m, s.count), 0);
  return (
    <section className={`${DASHBOARD_SURFACE_CLASS} p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--stride-coral)]/10 text-[var(--stride-coral)]">
          <BarChart3 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Leads by source</h2>
          <p className="text-xs text-[var(--dash-text-muted)]">Volume &amp; conversion per channel</p>
        </div>
      </div>
      {stats.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--dash-text-muted)]">No source data yet.</p>
      ) : (
        <ul className="space-y-3">
          {stats.map((s) => (
            <li key={s.source}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--dash-text-strong)]">{s.source}</span>
                <span className="text-[var(--dash-text-muted)]">
                  {s.count} · {formatPercent(s.conversion, 0)} conv.
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--dash-border)]">
                <div
                  className="h-full rounded-full bg-[var(--stride-coral)]"
                  style={{ width: `${max ? (s.count / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LeadDetailDrawer({
  lead,
  open,
  onClose,
  onEdit,
  onConvert,
  onDelete,
  onChangeStatus,
  statusPending,
}: {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onConvert: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onChangeStatus: (lead: Lead, status: string) => void;
  statusPending: boolean;
}) {
  const breakdown = useMemo(() => (lead ? scoreLead(leadToScoreInput(lead)) : null), [lead]);
  if (!lead) return null;
  const isConverted = lead.status === 'converted';

  return (
    <SalesDrawer
      open={open}
      onClose={onClose}
      title={lead.name}
      subtitle={lead.company ?? lead.email ?? undefined}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(lead)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)]"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
          {!isConverted ? (
            lead.status === 'disqualified' ? (
              <button
                type="button"
                disabled={statusPending}
                onClick={() => onChangeStatus(lead, 'qualified')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)] disabled:opacity-60"
              >
                Re-qualify
              </button>
            ) : (
              <button
                type="button"
                disabled={statusPending}
                onClick={() => onChangeStatus(lead, 'disqualified')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)] disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" /> Disqualify
              </button>
            )
          ) : null}
          {!isConverted ? (
            <button
              type="button"
              onClick={() => onConvert(lead)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
            >
              <ArrowRightLeft className="h-4 w-4" /> Convert
            </button>
          ) : (
            <Link
              href="/dashboard/sales/deals"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
            >
              View deal
            </Link>
          )}
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <LeadRatingBadge rating={lead.rating} />
          <StatusPill status={lead.status} />
          <ScoreBar score={lead.score} rating={lead.rating} />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-xs">
          <Field label="Email" value={lead.email} />
          <Field label="Phone" value={lead.phone} />
          <Field label="Source" value={lead.source} />
          <Field label="Owner" value={lead.owner?.name ?? null} />
          <Field
            label="Est. value"
            value={lead.estimatedValue != null ? formatSalesCurrency(lead.estimatedValue) : null}
          />
          <Field label="Last activity" value={formatRelativeTime(lead.lastActivityAt ?? lead.updatedAt)} />
          <Field label="Created" value={formatShortDate(lead.createdAt)} />
        </dl>

        {lead.convertedDeal ? (
          <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
              Converted deal
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-medium text-[var(--dash-text-strong)]">
                {lead.convertedDeal.name}
              </span>
              <SalesStageBadge stage={lead.convertedDeal.stage} />
            </div>
          </div>
        ) : null}

        {breakdown ? (
          <div className="rounded-lg border border-[var(--dash-border)] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
              <Sparkles className="h-3.5 w-3.5" /> Score breakdown
            </div>
            <ScoreBreakdown result={breakdown} />
          </div>
        ) : null}

        {lead.notes ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
              Notes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[var(--dash-text-strong)]">{lead.notes}</p>
          </div>
        ) : null}

        {!isConverted ? (
          <button
            type="button"
            onClick={() => onDelete(lead)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete lead
          </button>
        ) : null}
      </div>
    </SalesDrawer>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[var(--dash-text-muted)]">{label}</dt>
      <dd className="mt-0.5 break-words text-[var(--dash-text-strong)]">{value || '—'}</dd>
    </div>
  );
}

function LeadFormDrawer({
  mode,
  lead,
  reps,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  lead: Lead | null;
  reps: Rep[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(lead?.name ?? '');
  const [company, setCompany] = useState(lead?.company ?? '');
  const [email, setEmail] = useState(lead?.email ?? '');
  const [phone, setPhone] = useState(lead?.phone ?? '');
  const [source, setSource] = useState(lead?.source ?? '');
  const [estimatedValue, setEstimatedValue] = useState(
    lead?.estimatedValue != null ? String(lead.estimatedValue) : '',
  );
  const [ownerEmployeeId, setOwnerEmployeeId] = useState(lead?.ownerEmployeeId ?? '');
  const [notes, setNotes] = useState(lead?.notes ?? '');

  const saveMutation = useSalesMutation<unknown, void>(
    () => {
      const payload = {
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        source: source.trim() || null,
        notes: notes.trim() || null,
        estimatedValue: estimatedValue.trim() === '' ? null : Number(estimatedValue),
        ownerEmployeeId: ownerEmployeeId || null,
      };
      if (mode === 'edit' && lead) {
        return apiFetch(`/api/sales/leads/${lead.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiFetch('/api/sales/leads', { method: 'POST', body: JSON.stringify(payload) });
    },
    {
      onSuccess: () => toast.success(mode === 'edit' ? 'Lead updated.' : 'Lead created.'),
    },
  );

  const preview = useMemo(
    () =>
      scoreLead({
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        source: source.trim() || null,
        status: lead?.status ?? 'new',
        estimatedValue: estimatedValue.trim() === '' ? null : Number(estimatedValue),
        lastActivityAt: new Date(),
        createdAt: lead?.createdAt ?? new Date(),
      }),
    [email, phone, company, source, estimatedValue, lead],
  );

  const canSave = name.trim().length > 0 && !saveMutation.isPending;

  async function submit() {
    if (!canSave) return;
    try {
      await saveMutation.mutateAsync();
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.');
    }
  }

  return (
    <SalesDrawer
      open
      onClose={onClose}
      title={mode === 'edit' ? 'Edit lead' : 'New lead'}
      subtitle={mode === 'edit' ? lead?.name : 'Score updates live as you fill in details'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void submit()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'edit' ? 'Save changes' : 'Create lead'}
          </button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                Live lead score
              </span>
              <LeadRatingBadge rating={preview.rating} />
            </div>
            <span className="text-2xl font-bold tabular-nums text-[var(--dash-text-strong)]">
              {preview.score}
            </span>
          </div>
          <ScoreBar score={preview.score} rating={preview.rating} className="mt-2" />
          <div className="mt-3">
            <ScoreBreakdown result={preview} />
          </div>
        </div>

        <FormField label="Name" required>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="dash-auth-input w-full"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Company">
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="dash-auth-input w-full"
            />
          </FormField>
          <FormField label="Source">
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Referral, inbound…"
              className="dash-auth-input w-full"
            />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="dash-auth-input w-full"
            />
          </FormField>
          <FormField label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="dash-auth-input w-full"
            />
          </FormField>
        </div>
        <FormField label="Estimated value (KES)">
          <input
            type="number"
            min={0}
            step="any"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            placeholder="e.g. 500000"
            className="dash-auth-input w-full"
          />
        </FormField>
        <FormField label="Owner">
          <StrideSelect
            value={ownerEmployeeId}
            onChange={setOwnerEmployeeId}
            ariaLabel="Owner"
            className="w-full"
            options={[
              { value: '', label: 'Unassigned' },
              ...reps.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        </FormField>
        <FormField label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="dash-auth-input w-full"
          />
        </FormField>
      </form>
    </SalesDrawer>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--dash-text-muted)]">
        {label}
        {required ? <span className="text-[var(--stride-coral)]"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function leadToScoreInput(lead: Lead) {
  return {
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    source: lead.source,
    status: lead.status,
    estimatedValue: lead.estimatedValue,
    lastActivityAt: lead.lastActivityAt,
    createdAt: lead.createdAt,
  };
}

function LeadsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="dashboard-stat-card">
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--dash-border)]" />
            <div className="mt-3 h-6 w-16 animate-pulse rounded bg-[var(--dash-border)]" />
          </div>
        ))}
      </div>
      <div className={`${DASHBOARD_SURFACE_CLASS} p-4`}>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 flex-1 animate-pulse rounded bg-[var(--dash-border)]" />
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--dash-border)]" />
              <div className="h-4 w-16 animate-pulse rounded bg-[var(--dash-border)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
