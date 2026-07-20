'use client';

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Mail,
  Loader2,
  Printer,
  Download,
  AlertTriangle,
  Search,
  Users,
  FileText,
  X,
} from 'lucide-react';
import { useCurrencyFormatter } from '@/hooks/useEntityConfig';
import { useEntity } from '@/components/EntitySwitcher';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';
import type { OutsourcingClientOption } from '@/lib/outsourcing-client-context';
import { StrideSelect } from '@/components/ui/stride-select';
import type { PayrollSurfaceConfig } from '@/components/payroll/PayrollWorkspace';
import { PayrollSubnav } from '@/components/payroll/PayrollSubnav';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { DashboardEmptyState } from '@/components/dashboard/DashboardAsyncState';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';

interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string | null;
  clientName: string;
  departmentName: string | null;
  month: number;
  year: number;
  grossPay: string;
  netPay: string;
  status: string;
}

type ClientState = {
  clientId: string;
  clients: OutsourcingClientOption[];
  setClientId: (id: string) => void;
  showSwitcher: boolean;
};

const INTERNAL_CLIENT_STATE: ClientState = {
  clientId: '',
  clients: [],
  setClientId: () => {},
  showSwitcher: false,
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const NO_DEPARTMENT = 'No department';

function statusTone(status: string): { label: string; tone: DashStatusTone } {
  switch (String(status).trim().toUpperCase()) {
    case 'PAID':
      return { label: 'Paid', tone: 'success' };
    case 'APPROVED':
      return { label: 'Approved', tone: 'primary' };
    case 'PENDING':
      return { label: 'Pending', tone: 'warning' };
    default:
      return { label: 'Draft', tone: 'neutral' };
  }
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function PayslipsWorkspace({ config }: { config: PayrollSurfaceConfig }) {
  return (
    <Suspense
      fallback={
        <div className="p-8 animate-pulse">
          <div className="h-6 bg-neutral-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-neutral-100 rounded w-full mb-2" />
          <div className="h-4 bg-neutral-100 rounded w-5/6" />
        </div>
      }
    >
      {config.mode === 'outsourcing' ? (
        <OutsourcingPayslipsWorkspace config={config} />
      ) : (
        <PayslipsContent config={config} client={INTERNAL_CLIENT_STATE} />
      )}
    </Suspense>
  );
}

function OutsourcingPayslipsWorkspace({ config }: { config: PayrollSurfaceConfig }) {
  const { clientId, clients, setClientId, showSwitcher } = useOutsourcingClient({ excludePrimary: true });
  return (
    <PayslipsContent config={config} client={{ clientId, clients, setClientId, showSwitcher }} />
  );
}

function PayslipsContent({ config, client }: { config: PayrollSurfaceConfig; client: ClientState }) {
  const { activeEntity } = useEntity();
  const { clientId, clients, setClientId, showSwitcher } = client;
  const isOutsourcing = config.mode === 'outsourcing';
  const formatCurrency = useCurrencyFormatter();

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
  const departmentId = searchParams.get('departmentId') || '';
  const employeeIdsParam = searchParams.get('employeeIds') || '';

  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ sent: number; skipped: number; errors?: string[] } | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState<null | { count: number; employeeIds?: string[] }>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'flat' | 'department'>('flat');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const previewObjUrlRef = useRef<string | null>(null);

  const setPeriod = useCallback(
    (nextMonth: number, nextYear: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('month', String(nextMonth));
      params.set('year', String(nextYear));
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('month', String(month));
    params.set('year', String(year));
    if (clientId) params.set('clientId', clientId);
    if (departmentId) params.set('departmentId', departmentId);
    if (employeeIdsParam.trim()) params.set('employeeIds', employeeIdsParam.trim());
    fetch(`${config.apiBase}?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPayrolls(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch(() => {
        setPayrolls([]);
        setError('Failed to load payroll');
      })
      .finally(() => setLoading(false));
  }, [month, year, clientId, departmentId, employeeIdsParam, activeEntity.id, config.apiBase]);

  // Keep selection/preview valid as the list changes.
  useEffect(() => {
    setChecked(new Set());
    if (payrolls.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (prev && payrolls.some((p) => p.id === prev) ? prev : payrolls[0].id));
  }, [payrolls]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payrolls;
    return payrolls.filter((p) =>
      [p.employeeName, p.employeeNumber ?? '', p.departmentName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [payrolls, search]);

  const groups = useMemo(() => {
    const map = new Map<string, PayrollRecord[]>();
    for (const p of filtered) {
      const key = p.departmentName || NO_DEPARTMENT;
      const list = map.get(key);
      if (list) list.push(p);
      else map.set(key, [p]);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === NO_DEPARTMENT) return 1;
      if (b[0] === NO_DEPARTMENT) return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  const selected = useMemo(
    () => payrolls.find((p) => p.id === selectedId) ?? null,
    [payrolls, selectedId],
  );

  // Fetch the selected payslip as a blob and embed it — the raw HTTP PDF can't
  // be iframed directly because middleware sets X-Frame-Options: DENY.
  useEffect(() => {
    if (!selectedId) {
      setPreviewUrl(null);
      return;
    }
    const controller = new AbortController();
    setPreviewLoading(true);
    setPreviewError(null);
    fetch(`${config.apiBase}/${selectedId}/pdf?inline=1`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(typeof data.error === 'string' ? data.error : `Failed to load PDF (${res.status})`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (previewObjUrlRef.current) URL.revokeObjectURL(previewObjUrlRef.current);
        const url = URL.createObjectURL(blob);
        previewObjUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setPreviewError(err instanceof Error ? err.message : 'Failed to load PDF');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false);
      });
    return () => controller.abort();
  }, [selectedId, config.apiBase]);

  // Revoke the last preview object URL on unmount.
  useEffect(
    () => () => {
      if (previewObjUrlRef.current) URL.revokeObjectURL(previewObjUrlRef.current);
    },
    [],
  );

  const summary = useMemo(() => {
    return payrolls.reduce(
      (acc, p) => {
        const gross = Number(p.grossPay) || 0;
        const net = Number(p.netPay) || 0;
        acc.gross += gross;
        acc.net += net;
        acc.deductions += Math.max(0, gross - net);
        return acc;
      },
      { gross: 0, net: 0, deductions: 0 },
    );
  }, [payrolls]);

  const checkedEmployeeIds = useMemo(
    () => payrolls.filter((p) => checked.has(p.id)).map((p) => p.employeeId),
    [payrolls, checked],
  );

  // ── selection helpers ──
  const toggleOne = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleMany = (rows: PayrollRecord[]) => {
    const ids = rows.map((r) => r.id);
    const allSelected = ids.every((id) => checked.has(id));
    setChecked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };
  const clearSelection = () => setChecked(new Set());

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => checked.has(p.id));
  const someFilteredSelected = filtered.some((p) => checked.has(p.id));

  // ── PDF URLs (server renders the exact document employees receive) ──
  const singleInlineUrl = (id: string) => `${config.apiBase}/${id}/pdf?inline=1`;
  const singleDownloadUrl = (id: string) => `${config.apiBase}/${id}/pdf`;
  const bulkUrl = (inline: boolean, employeeIdsOverride?: string[]) => {
    const params = new URLSearchParams();
    params.set('month', String(month));
    params.set('year', String(year));
    if (clientId) params.set('clientId', clientId);
    if (departmentId) params.set('departmentId', departmentId);
    const ids =
      employeeIdsOverride && employeeIdsOverride.length
        ? employeeIdsOverride.join(',')
        : employeeIdsParam.trim();
    if (ids) params.set('employeeIds', ids);
    if (inline) params.set('inline', '1');
    return `${config.apiBase}/payslips-pdf?${params.toString()}`;
  };

  const printViaUrl = async (url: string) => {
    const frame = printFrameRef.current;
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (!frame) {
        window.open(blobUrl, '_blank', 'noopener');
        return;
      }
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(blobUrl, '_blank', 'noopener');
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      };
      frame.src = blobUrl;
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  };

  const downloadFromUrl = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const sendPayslips = useCallback(
    async (employeeIds?: string[], singleId?: string) => {
      if (singleId) setSendingId(singleId);
      else setSending(true);
      setSendResult(null);
      try {
        const ids =
          employeeIds && employeeIds.length
            ? employeeIds
            : employeeIdsParam
              ? employeeIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
              : undefined;
        const res = await fetch(`${config.apiBase}/send-payslips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month,
            year,
            ...(clientId ? { clientId } : {}),
            ...(departmentId ? { departmentId } : {}),
            ...(ids ? { employeeIds: ids } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSendResult({ sent: 0, skipped: 0, errors: [data.error || 'Failed to send payslips'] });
          return;
        }
        setSendResult({ sent: data.sent ?? 0, skipped: data.skipped ?? 0, errors: data.errors });
      } catch {
        setSendResult({ sent: 0, skipped: 0, errors: ['Network error'] });
      } finally {
        setSending(false);
        setSendingId(null);
      }
    },
    [config.apiBase, month, year, clientId, departmentId, employeeIdsParam],
  );

  const yearOptions = (() => {
    const current = new Date().getFullYear();
    const years = new Set<number>([current - 2, current - 1, current, current + 1, year]);
    return Array.from(years)
      .sort((a, b) => b - a)
      .map((y) => ({ value: String(y), label: String(y) }));
  })();

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <StrideSelect
        value={String(month)}
        onChange={(value) => setPeriod(parseInt(value, 10), year)}
        ariaLabel="Month"
        options={MONTHS.map((label, i) => ({ value: String(i + 1), label }))}
        className="min-w-[8rem]"
      />
      <StrideSelect
        value={String(year)}
        onChange={(value) => setPeriod(month, parseInt(value, 10))}
        ariaLabel="Year"
        options={yearOptions}
        className="min-w-[6rem]"
      />
      <span className="mx-1 hidden h-6 w-px bg-[var(--dash-border)] sm:block" aria-hidden />
      <button
        type="button"
        onClick={() => setShowSendConfirm({ count: payrolls.length })}
        disabled={sending || payrolls.length === 0}
        className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        Email all
      </button>
      <button
        type="button"
        onClick={() => downloadFromUrl(bulkUrl(false))}
        disabled={payrolls.length === 0}
        className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="h-4 w-4" />
        Download all
      </button>
      <button
        type="button"
        onClick={() => printViaUrl(bulkUrl(true))}
        disabled={payrolls.length === 0}
        className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Printer className="h-4 w-4" />
        Print all
      </button>
    </div>
  );

  const renderRow = (p: PayrollRecord) => {
    const st = statusTone(p.status);
    const active = p.id === selectedId;
    const isChecked = checked.has(p.id);
    return (
      <li key={p.id} className={active ? 'bg-primary-50' : ''}>
        <div className="flex items-center gap-2 pl-3 pr-2">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => toggleOne(p.id)}
            className="h-4 w-4 shrink-0 accent-primary-600"
            aria-label={`Select ${p.employeeName}`}
          />
          <button
            type="button"
            onClick={() => setSelectedId(p.id)}
            aria-current={active ? 'true' : undefined}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 text-left"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                active ? 'bg-primary-200 text-primary-900' : 'bg-neutral-100 text-neutral-600'
              }`}
              aria-hidden
            >
              {initials(p.employeeName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-neutral-900">{p.employeeName}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-primary-900">
                  {formatCurrency(Number(p.netPay) || 0)}
                </span>
              </span>
              <span className="mt-0.5 flex items-center">
                <span className={dashStatusChip(st.tone)}>{st.label}</span>
              </span>
            </span>
          </button>
        </div>
      </li>
    );
  };

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow={isOutsourcing ? 'HR Outsourcing' : 'HR & Payroll'}
        title="Payslips"
        description="Preview, email, and print the exact PDF payslip each employee receives."
        meta={`${MONTHS[month - 1]} ${year} · ${payrolls.length} payslip${payrolls.length === 1 ? '' : 's'}`}
        footer={<PayrollSubnav config={config} clientId={clientId} />}
        actions={headerActions}
      />

      {isOutsourcing && showSwitcher ? (
        <div className="max-w-md">
          <OutsourcingClientSwitcher clients={clients} value={clientId} onChange={setClientId} />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : null}

      {sendResult ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <div>
            <p className="font-medium text-neutral-800">
              Emailed {sendResult.sent} · Skipped (no email) {sendResult.skipped}
            </p>
            {sendResult.errors && sendResult.errors.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-red-600">
                {sendResult.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {sendResult.errors.length > 5 ? <li>…and {sendResult.errors.length - 5} more</li> : null}
              </ul>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setSendResult(null)}
            className="shrink-0 text-neutral-500 hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {!loading && payrolls.length > 0 ? (
        <DashboardStatGrid columns={4}>
          <DashboardStatCard label="Employees" value={payrolls.length} tone="primary" />
          <DashboardStatCard label="Gross" value={formatCurrency(summary.gross)} tone="sky" />
          <DashboardStatCard label="Deductions" value={formatCurrency(summary.deductions)} tone="warning" />
          <DashboardStatCard label="Net pay" value={formatCurrency(summary.net)} tone="success" />
        </DashboardStatGrid>
      ) : null}

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-24 rounded-2xl bg-neutral-100" />
          <div className="h-72 rounded-2xl bg-neutral-100" />
        </div>
      ) : payrolls.length === 0 ? (
        <div className="dashboard-surface shadow-sm">
          <DashboardEmptyState
            icon={FileText}
            title={`No payslips for ${MONTHS[month - 1]} ${year}`}
            description="Generate and approve payroll for this period, then payslips will appear here to preview, email, and print."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* Employee list */}
          <div className="dashboard-surface flex h-[80vh] flex-col overflow-hidden shadow-sm">
            <div className="space-y-2 border-b border-[var(--dash-border-subtle)] p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employees…"
                  className="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-input-bg)] py-2 pl-9 pr-3 text-sm text-[var(--dash-text-strong)] placeholder:text-[var(--dash-text-subtle)] focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-neutral-500">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                    }}
                    onChange={() => toggleMany(filtered)}
                    className="h-4 w-4 accent-primary-600"
                  />
                  Select all
                </label>
                <StrideSelect
                  value={groupBy}
                  onChange={(value) => setGroupBy(value === 'department' ? 'department' : 'flat')}
                  ariaLabel="Group by"
                  options={[
                    { value: 'flat', label: 'Flat list' },
                    { value: 'department', label: 'By department' },
                  ]}
                  className="min-w-[9rem]"
                />
              </div>
            </div>

            {checked.size > 0 ? (
              <div className="flex items-center justify-between gap-2 border-b border-[var(--dash-border-subtle)] bg-primary-50 px-3 py-2">
                <span className="text-sm font-medium text-primary-900">{checked.size} selected</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Email selected"
                    onClick={() => setShowSendConfirm({ count: checkedEmployeeIds.length, employeeIds: checkedEmployeeIds })}
                    disabled={sending}
                    className="rounded-md p-1.5 text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Download selected"
                    onClick={() => downloadFromUrl(bulkUrl(false, checkedEmployeeIds))}
                    className="rounded-md p-1.5 text-primary-700 hover:bg-primary-100"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Print selected"
                    onClick={() => printViaUrl(bulkUrl(true, checkedEmployeeIds))}
                    className="rounded-md p-1.5 text-primary-700 hover:bg-primary-100"
                  >
                    <Printer className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Clear selection"
                    onClick={clearSelection}
                    className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="p-6 text-center text-sm text-neutral-500">No employees match “{search}”.</p>
              ) : groupBy === 'department' ? (
                groups.map(([dept, rows]) => {
                  const ids = rows.map((r) => r.id);
                  const allSel = ids.every((id) => checked.has(id));
                  const someSel = ids.some((id) => checked.has(id));
                  const groupNet = rows.reduce((sum, r) => sum + (Number(r.netPay) || 0), 0);
                  return (
                    <div key={dept}>
                      <div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)] px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allSel}
                          ref={(el) => {
                            if (el) el.indeterminate = someSel && !allSel;
                          }}
                          onChange={() => toggleMany(rows)}
                          className="h-4 w-4 accent-primary-600"
                          aria-label={`Select ${dept}`}
                        />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                          {dept}
                        </span>
                        <span className="rounded-full bg-neutral-200/70 px-1.5 text-[10px] font-medium text-neutral-600">
                          {rows.length}
                        </span>
                        <span className="ml-auto text-xs font-medium tabular-nums text-neutral-500">
                          {formatCurrency(groupNet)}
                        </span>
                      </div>
                      <ul className="divide-y divide-[var(--dash-border-subtle)]">{rows.map(renderRow)}</ul>
                    </div>
                  );
                })
              ) : (
                <ul className="divide-y divide-[var(--dash-border-subtle)]">{filtered.map(renderRow)}</ul>
              )}
            </div>
          </div>

          {/* PDF preview */}
          <div className="flex h-[80vh] min-w-0 flex-col gap-3">
            {selected ? (
              <>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-neutral-500">
                    Previewing <span className="font-medium text-neutral-800">{selected.employeeName}</span>
                    <span className="text-neutral-400"> · exact PDF the employee receives</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => sendPayslips([selected.employeeId], selected.employeeId)}
                      disabled={sendingId === selected.employeeId}
                      className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      {sendingId === selected.employeeId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadFromUrl(singleDownloadUrl(selected.id))}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => printViaUrl(singleInlineUrl(selected.id))}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                  </div>
                </div>
                <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-2xl border border-[var(--dash-border)] bg-neutral-100 shadow-sm">
                  {previewLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-neutral-600">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading PDF…
                    </div>
                  ) : null}
                  {previewError ? (
                    <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-amber-800">
                      {previewError}
                    </div>
                  ) : null}
                  {previewUrl && !previewLoading && !previewError ? (
                    <iframe
                      key={selected.id}
                      title={`Payslip — ${selected.employeeName}`}
                      src={previewUrl}
                      className="h-full w-full border-0 bg-white"
                    />
                  ) : null}
                </div>
              </>
            ) : (
              <div className="dashboard-surface flex flex-1 items-center justify-center shadow-sm">
                <DashboardEmptyState
                  icon={Users}
                  title="Select an employee"
                  description="Choose an employee from the list to preview their payslip PDF."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm email (all / selected) */}
      {showSendConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-5 shadow-lg sm:p-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {showSendConfirm.employeeIds ? 'Email selected payslips' : 'Email all payslips'}
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Send payslips to {showSendConfirm.count} employee{showSendConfirm.count === 1 ? '' : 's'} for{' '}
              {MONTHS[month - 1]} {year}? Each email includes the PDF attached. Employees without an email on file
              are skipped.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowSendConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2"
                onClick={async () => {
                  const ids = showSendConfirm.employeeIds;
                  setShowSendConfirm(null);
                  await sendPayslips(ids);
                }}
              >
                <Mail className="h-4 w-4" />
                Confirm & send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Offscreen frame used to print PDFs without leaving the page
          (kept renderable — a display:none iframe won't print in Chrome). */}
      <iframe
        ref={printFrameRef}
        title="Print payslips"
        aria-hidden
        tabIndex={-1}
        style={{ position: 'fixed', width: 0, height: 0, border: 0, left: '-9999px', top: 0 }}
      />
    </DashboardPage>
  );
}
