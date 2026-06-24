'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  HeartPulse,
  Home,
  Landmark,
  Loader2,
  Save,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import useEntityConfig, { useCurrencyFormatter } from '@/hooks/useEntityConfig';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';

type ItemStatus = 'pending' | 'prepared' | 'submitted' | 'paid' | 'overdue';

type StatutoryData = {
  period: { month: number; year: number };
  client: {
    id: string;
    name: string;
    currency: string;
    registrations: {
      kraPin: string | null;
      nssfEmployerNumber: string | null;
      shifEmployerNumber: string | null;
    };
  };
  totals: {
    employeeCount: number;
    payrollCount: number;
    totalGrossPay: number;
    totalPaye: number;
    totalNssfEmployee: number;
    totalNssfEmployer: number;
    totalShif: number;
    totalAhlEmployee: number;
    totalAhlEmployer: number;
    totalOtherDeductions: number;
  };
  compliance: {
    dueDate: string;
    returnId: string | null;
    status: string;
    coveragePct: number;
    employeeDataGaps: {
      idNumber: number;
      kraPin: number;
      nssfNumber: number;
      nhifNumber: number;
    };
  };
  obligations: Array<{
    id: string | null;
    obligationType: string;
    authority: string;
    employeeAmount: number;
    employerAmount: number;
    liabilityAmount: number;
    dueDate: string;
    status: ItemStatus;
    referenceNumber: string | null;
    paymentReference: string | null;
    notes: string | null;
    submittedAt: string | null;
    paidAt: string | null;
  }>;
  notes: string | null;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type ObligationMeta = {
  label: string;
  portal: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

function obligationMeta(type: string): ObligationMeta {
  if (type === 'paye') {
    return { label: 'PAYE', portal: 'KRA iTax', icon: Building2 };
  }
  if (type === 'nssf') {
    return { label: 'NSSF', portal: 'NSSF Portal', icon: Shield };
  }
  if (type === 'shif') {
    return { label: 'SHIF', portal: 'SHA Portal', icon: HeartPulse };
  }
  if (type === 'housing_levy') {
    return { label: 'Housing Levy', portal: 'KRA iTax', icon: Home };
  }
  return {
    label: type.replace(/_/g, ' ').toUpperCase(),
    portal: '',
    icon: Landmark,
  };
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

function statusBadgeClass(status: string) {
  if (status === 'paid') {
    return 'border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] text-[var(--dash-success-fg)]';
  }
  if (status === 'submitted' || status === 'filed') {
    return 'border-[var(--dash-border)] bg-[var(--dash-surface-raised)] text-[var(--dash-text-body)]';
  }
  if (status === 'prepared' || status === 'review_ready') {
    return 'border-[var(--dash-warning-border)] bg-[var(--dash-warning-bg)] text-[var(--dash-warning-fg)]';
  }
  if (status === 'overdue') {
    return 'border-[var(--dash-danger-border)] bg-[var(--dash-danger-bg)] text-[var(--dash-danger-fg)]';
  }
  return 'border-[var(--dash-border)] bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)]';
}

function countdownClass(days: number) {
  if (days <= 3) {
    return 'border-[var(--dash-danger-border)] bg-[var(--dash-danger-bg)] text-[var(--dash-danger-fg)]';
  }
  if (days <= 7) {
    return 'border-[var(--dash-warning-border)] bg-[var(--dash-warning-bg)] text-[var(--dash-warning-fg)]';
  }
  return 'border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] text-[var(--dash-success-fg)]';
}

function nextAction(status: ItemStatus): { label: string; target: ItemStatus; primary?: boolean } | null {
  if (status === 'pending') return { label: 'Mark prepared', target: 'prepared' };
  if (status === 'prepared') return { label: 'Mark submitted', target: 'submitted' };
  if (status === 'submitted') return { label: 'Confirm payment', target: 'paid', primary: true };
  return null;
}

function ObligationCard({
  item,
  money,
  locale,
  busy,
  onAdvance,
}: {
  item: StatutoryData['obligations'][number];
  money: (amount: number) => string;
  locale: string;
  busy: boolean;
  onAdvance: (id: string, status: ItemStatus) => void;
}) {
  const meta = obligationMeta(item.obligationType);
  const Icon = meta.icon;
  const action = nextAction(item.status);

  return (
    <article className="dashboard-panel flex h-full flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--dash-border)] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)]">
            <Icon className="h-4 w-4 text-[var(--dash-text-muted)]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-[var(--dash-text-strong)]">{meta.label}</p>
            <p className="truncate text-[11px] text-[var(--dash-text-subtle)]">{meta.portal || item.authority}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${statusBadgeClass(item.status)}`}
        >
          {statusLabel(item.status)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--dash-text-subtle)]">Employee</span>
          <span className="font-medium tabular-nums text-[var(--dash-text-body)]">{money(item.employeeAmount)}</span>
        </div>
        {item.employerAmount > 0 ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--dash-text-subtle)]">Employer</span>
            <span className="font-medium tabular-nums text-[var(--dash-text-body)]">{money(item.employerAmount)}</span>
          </div>
        ) : null}
        <div className="mt-1 flex items-end justify-between border-t border-[var(--dash-border)] pt-3">
          <span className="text-xs font-medium text-[var(--dash-text-muted)]">Total due</span>
          <span className="text-base font-semibold tabular-nums text-[var(--dash-text-strong)]">
            {money(item.liabilityAmount)}
          </span>
        </div>
        <p className="text-[11px] text-[var(--dash-text-faint)]">
          Due{' '}
          {new Date(item.dueDate).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
        </p>
      </div>

      <div className="border-t border-[var(--dash-border)] px-4 py-3 sm:px-5">
        {item.id && action ? (
          <button
            type="button"
            onClick={() => onAdvance(item.id!, action.target)}
            disabled={busy}
            className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
              action.primary
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)]'
            }`}
          >
            {busy ? 'Updating…' : action.label}
          </button>
        ) : item.status === 'paid' ? (
          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] py-2 text-xs font-semibold text-[var(--dash-success-fg)]">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Payment confirmed
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--dash-border)] bg-[var(--dash-surface-muted)] py-2 text-center text-[11px] text-[var(--dash-text-subtle)]">
            Save snapshot to enable actions
          </div>
        )}
      </div>
    </article>
  );
}

export default function PayrollStatutoryPage() {
  const entityConfig = useEntityConfig();
  const formatCurrency = useCurrencyFormatter();
  const money = (amount: number) => formatCurrency(Number(amount || 0));
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<StatutoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [itemBusy, setItemBusy] = useState<string | null>(null);
  const [refOpen, setRefOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year) });
      const res = await fetch(`/api/payroll/statutory?${params.toString()}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to load statutory page');
      const typed = payload as StatutoryData;
      setData(typed);
      setNotes(typed.notes || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load statutory data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const totals = data?.totals;
  const totalLiability = useMemo(() => {
    if (!data) return 0;
    return data.obligations.reduce((acc, item) => acc + Number(item.liabilityAmount || 0), 0);
  }, [data]);

  const filedCount = useMemo(() => {
    if (!data) return 0;
    return data.obligations.filter((o) => o.status === 'paid' || o.status === 'submitted').length;
  }, [data]);

  const daysUntilDue = useMemo(() => {
    if (!data) return null;
    const due = new Date(data.compliance.dueDate);
    return Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }, [data]);

  const saveSnapshot = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/payroll/statutory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, notes }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to save snapshot');
      setMessage(payload.message || 'Snapshot saved');
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save snapshot');
    } finally {
      setSaving(false);
    }
  };

  const updateItemStatus = async (itemId: string, status: ItemStatus) => {
    setItemBusy(itemId);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/statutory/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to update item');
      await fetchData();
      setMessage(`Marked as ${statusLabel(status)}.`);
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update item');
    } finally {
      setItemBusy(null);
    }
  };

  const gaps = data?.compliance.employeeDataGaps;
  const hasCriticalGaps = Boolean(gaps && (gaps.kraPin > 0 || gaps.idNumber > 0));
  const progressPct = data ? (filedCount / data.obligations.length) * 100 : 0;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title={`Statutory · ${entityConfig.payroll.runLabel}`}
        icon={Landmark}
        description={
          <>
            <EntityContextBanner />
            <p className="mt-2 text-[var(--dash-text-muted)]">{entityConfig.payroll.statutoryComplianceIntro}</p>
          </>
        }
        meta={
          data?.client ? (
            <>
              Employer:{' '}
              <span className="font-medium text-[var(--dash-text-strong)]">{data.client.name}</span>
            </>
          ) : undefined
        }
        actions={
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="dash-auth-input rounded-lg px-3 py-2 text-sm"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
              className="dash-auth-input w-28 rounded-lg px-3 py-2 text-sm"
              min={2020}
              max={2100}
            />
            <button
              type="button"
              onClick={saveSnapshot}
              disabled={saving || loading}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save filing snapshot
            </button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-[var(--dash-danger-border)] bg-[var(--dash-danger-bg)] p-3 text-sm text-[var(--dash-danger-fg)]">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-lg border border-[var(--dash-success-border)] bg-[var(--dash-success-bg)] p-3 text-sm text-[var(--dash-success-fg)]">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="dashboard-panel flex items-center gap-2 p-8 text-sm text-[var(--dash-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading statutory data…
        </div>
      ) : !data || !totals ? (
        <div className="dashboard-panel p-8 text-sm text-[var(--dash-text-muted)]">
          No statutory data available for this period.
        </div>
      ) : (
        <>
          <div className="dashboard-panel mb-6 overflow-hidden">
            <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5">
              <div>
                <p className="text-sm font-semibold text-[var(--dash-text-strong)]">
                  {filedCount} of {data.obligations.length} obligations filed
                </p>
                <p className="mt-0.5 text-xs text-[var(--dash-text-subtle)]">
                  {MONTHS[month - 1]} {year} compliance cycle
                </p>
              </div>
              {daysUntilDue !== null ? (
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${countdownClass(daysUntilDue)}`}
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {daysUntilDue > 0
                    ? `${daysUntilDue} days until deadline`
                    : daysUntilDue === 0
                      ? 'Due today'
                      : `${Math.abs(daysUntilDue)} days overdue`}
                </div>
              ) : null}
            </div>
            <div className="h-1 bg-[var(--dash-surface-muted)]">
              <div
                className="h-full bg-primary-600 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.obligations.map((item) => (
              <ObligationCard
                key={item.obligationType}
                item={item}
                money={money}
                locale={entityConfig.currency.locale}
                busy={itemBusy === item.id}
                onAdvance={updateItemStatus}
              />
            ))}
          </div>

          <DashboardStatGrid columns={4} className="mb-6">
            <DashboardStatCard label="Gross payroll" value={money(totals.totalGrossPay)} tone="primary" />
            <DashboardStatCard label="Total liability" value={money(totalLiability)} tone="violet" />
            <DashboardStatCard
              label="Coverage"
              value={`${data.compliance.coveragePct.toFixed(1)}%`}
              hint={`${totals.payrollCount} records / ${totals.employeeCount} staff`}
              tone="emerald"
            />
            <DashboardStatCard
              label="Return status"
              value={
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(data.compliance.status)}`}
                >
                  {statusLabel(data.compliance.status)}
                </span>
              }
              tone="amber"
            />
          </DashboardStatGrid>

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div
              className={`dashboard-panel p-5 ${
                hasCriticalGaps ? 'ring-1 ring-[var(--dash-warning-border)]' : ''
              }`}
            >
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                {hasCriticalGaps ? (
                  <ShieldAlert className="h-4 w-4 text-[var(--dash-warning-fg)]" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-[var(--dash-success-fg)]" aria-hidden />
                )}
                Employee filing readiness
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'National ID', value: gaps?.idNumber ?? 0 },
                  { label: entityConfig.payroll.taxPinLabel, value: gaps?.kraPin ?? 0 },
                  { label: 'NSSF number', value: gaps?.nssfNumber ?? 0 },
                  { label: entityConfig.payroll.missingHealthSchemeGapLabel, value: gaps?.nhifNumber ?? 0 },
                ].map((gap) => (
                  <div
                    key={gap.label}
                    className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-3"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dash-text-subtle)]">
                      {gap.label}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--dash-text-strong)]">
                      {gap.value}
                    </p>
                    <p className="text-[10px] text-[var(--dash-text-faint)]">missing</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-panel p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
                <AlertTriangle className="h-4 w-4 text-[var(--dash-text-muted)]" aria-hidden />
                Filing notes
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                placeholder="Capture filing references, audit comments, and payment confirmations."
                className="dash-auth-input w-full resize-none rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="dashboard-panel overflow-hidden">
            <button
              type="button"
              onClick={() => setRefOpen(!refOpen)}
              className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-[var(--dash-text-body)] transition-colors hover:bg-[var(--dash-hover)]"
            >
              <span className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-[var(--dash-text-muted)]" aria-hidden />
                Statutory coverage reference
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[var(--dash-text-faint)] transition-transform ${refOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {refOpen ? (
              <div className="border-t border-[var(--dash-border)] px-5 pb-5">
                <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {entityConfig.payroll.statutoryItems.map((item) => (
                    <li
                      key={item.key}
                      className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-3 py-2.5 text-sm"
                    >
                      <span className="mr-2 inline-flex rounded border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--dash-text-muted)]">
                        {item.badge}
                      </span>
                      <span className="font-medium text-[var(--dash-text-strong)]">{item.label}</span>
                      <p className="mt-1 text-xs text-[var(--dash-text-subtle)]">{item.sublabel}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-[var(--dash-text-subtle)]">
                  Returns: {entityConfig.payroll.reportLabels.monthly} · {entityConfig.payroll.reportLabels.annual}
                </p>
              </div>
            ) : null}
          </div>
        </>
      )}
    </DashboardPage>
  );
}
