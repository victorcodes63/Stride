'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';
import {
  ColumnPickerMenu,
  QuoteStatusBadge,
  SalesDrawer,
  SalesEmptyState,
  SalesFilterBar,
  useColumnVisibility,
  type ColumnOption,
  type FilterSelect,
} from '@/components/dashboard/sales';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/hooks/useApiResource';
import { apiFetch, salesKeys, useSalesMutation, useSalesResource } from '@/lib/sales/hooks';
import { formatCompactCurrency, formatSalesCurrency, formatShortDate } from '@/lib/sales/format';
import { SALES_QUOTE_STATUSES } from '@/lib/sales/schema';

type PageTab = 'quotes' | 'approvals';

type QuoteColumnId = 'quote' | 'account' | 'status' | 'total' | 'validUntil';

const QUOTE_COLUMN_ORDER: QuoteColumnId[] = [
  'quote',
  'account',
  'status',
  'total',
  'validUntil',
];

const QUOTE_COLUMN_OPTIONS: ColumnOption<QuoteColumnId>[] = [
  { id: 'quote', label: 'Quote', locked: true },
  { id: 'account', label: 'Account' },
  { id: 'status', label: 'Status' },
  { id: 'total', label: 'Total' },
  { id: 'validUntil', label: 'Valid until' },
];

const DEFAULT_QUOTE_COLUMNS: QuoteColumnId[] = [
  'quote',
  'account',
  'status',
  'total',
  'validUntil',
];

type Totals = {
  subtotal: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  total: number;
};

type QuoteListItem = {
  id: string;
  quoteNumber: number;
  title: string;
  status: string;
  currency: string;
  dealId: string | null;
  deal: { id: string; name: string } | null;
  accountsClientId: string | null;
  accountsClient: { id: string; name: string; currency: string } | null;
  accountsInvoiceId: string | null;
  issueDate: string;
  validUntil: string | null;
  discountPct: number;
  taxRateBps: number;
  sentAt: string | null;
  acceptedAt: string | null;
  lineItemCount: number;
  totals: Totals;
};

type ApprovalInboxItem = {
  id: string;
  status: string;
  effectiveDiscountPct: number | null;
  createdAt: string;
  quote: {
    id: string;
    quoteNumber: number;
    title: string;
    status: string;
    currency: string;
    discountPct: number;
    accountsClient: { id: string; name: string } | null;
    createdBy: { id: string; name: string } | null;
  } | null;
  requestedBy: { id: string; name: string; email: string };
};

type LineItem = {
  id?: string;
  tempId: string;
  productId: string | null;
  product?: { id: string; name: string; sku: string | null } | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  priceOverridden?: boolean;
  listPrice?: number | null;
  costPrice?: number | null;
  margin?: number | null;
  isRecurring: boolean;
  termMonths: number | null;
  sortOrder: number;
};

type QuoteDetail = QuoteListItem & {
  notes: string | null;
  terms: string | null;
  createdBy: { id: string; name: string } | null;
  canViewMargin?: boolean;
  lineItems: Array<Omit<LineItem, 'tempId'>>;
};

type ClientOpt = { id: string; name: string; currency: string };
type DealOpt = {
  id: string;
  name: string;
  currency: string;
  accountsClientId: string | null;
  accountsClient: { id: string; name: string } | null;
};
type ProductOpt = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unitPrice: number;
  costPrice?: number | null;
  margin?: number | null;
  currency: string;
  isRecurring: boolean;
  defaultTermMonths: number | null;
  active: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Mirror of `lineItemExtendedAmount` for live client-side totals. */
function extendedAmount(li: {
  quantity: number;
  unitPrice: number;
  discountPct: number;
  isRecurring: boolean;
  termMonths: number | null;
}): number {
  const base = li.quantity * li.unitPrice * (1 - Math.min(100, Math.max(0, li.discountPct)) / 100);
  const months = li.isRecurring && li.termMonths && li.termMonths > 0 ? li.termMonths : 1;
  return round2(base * months);
}

function computeTotals(lines: LineItem[], discountPct: number, taxRateBps: number): Totals {
  const subtotal = round2(lines.reduce((s, l) => s + extendedAmount(l), 0));
  const pct = Math.min(100, Math.max(0, discountPct));
  const discountAmount = round2((subtotal * pct) / 100);
  const netAmount = round2(subtotal - discountAmount);
  const taxAmount = round2((netAmount * Math.max(0, taxRateBps)) / 10000);
  const total = round2(netAmount + taxAmount);
  return { subtotal, discountAmount, netAmount, taxAmount, total };
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof FileText;
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

export default function SalesQuotesContent() {
  const [tab, setTab] = useState<PageTab>('quotes');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [builder, setBuilder] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<QuoteListItem | null>(null);

  const quoteColumns = useColumnVisibility<QuoteColumnId>({
    storageKey: 'stride.sales.quotes.visibleColumns.v1',
    columnOrder: QUOTE_COLUMN_ORDER,
    defaults: DEFAULT_QUOTE_COLUMNS,
    locked: ['quote'],
  });

  const quotesQuery = useSalesResource<{ quotes: QuoteListItem[] }>(
    salesKeys.quotes(),
    '/api/sales/quotes',
  );
  const quotes = useMemo(() => quotesQuery.data?.quotes ?? [], [quotesQuery.data]);

  const deleteMutation = useSalesMutation<unknown, string>(
    (id) => apiFetch(`/api/sales/quotes/${id}`, { method: 'DELETE' }),
    { onSuccess: () => toast.success('Quote deleted.') },
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((quote) => {
      if (statusFilter && quote.status !== statusFilter) return false;
      if (q) {
        const hay = `${quote.title} ${quote.accountsClient?.name ?? ''} Q-${quote.quoteNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [quotes, search, statusFilter]);

  const kpis = useMemo(() => {
    const total = quotes.length;
    const sent = quotes.filter((q) => q.status === 'sent').length;
    const accepted = quotes.filter((q) => q.status === 'accepted').length;
    const pendingApproval = quotes.filter((q) => q.status === 'pending_approval').length;
    const acceptedValue = quotes
      .filter((q) => q.status === 'accepted')
      .reduce((s, q) => s + q.totals.total, 0);
    return { total, sent, accepted, acceptedValue, pendingApproval };
  }, [quotes]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) setSelectedId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  const filterSelects: FilterSelect[] = [
    {
      id: 'status',
      value: statusFilter,
      ariaLabel: 'Filter by status',
      onChange: setStatusFilter,
      options: [
        { value: '', label: 'All statuses' },
        ...SALES_QUOTE_STATUSES.map((s) => ({
          value: s,
          label: s === 'pending_approval' ? 'Pending approval' : s[0].toUpperCase() + s.slice(1),
        })),
      ],
    },
  ];

  const isLoading = quotesQuery.isLoading;
  const isError = quotesQuery.isError;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Quotes"
        description="Build branded quotations, track their status, and convert accepted quotes into invoices."
        icon={FileText}
        actions={
          tab === 'quotes' ? (
            <button
              type="button"
              onClick={() => setBuilder({ mode: 'create' })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> New quote
            </button>
          ) : null
        }
      />

      <div className="mb-4 flex gap-1 border-b border-[var(--dash-border)]">
        {(
          [
            { id: 'quotes' as const, label: 'All quotes', icon: FileText },
            { id: 'approvals' as const, label: 'Approvals', icon: ClipboardCheck },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-[var(--stride-coral)] text-[var(--dash-text-strong)]'
                : 'border-transparent text-[var(--dash-text-muted)] hover:text-[var(--dash-text-strong)]'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.id === 'approvals' && kpis.pendingApproval > 0 ? (
              <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-500/20 dark:text-violet-300">
                {kpis.pendingApproval}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'approvals' ? (
        <ApprovalsInbox onOpenQuote={setSelectedId} />
      ) : isError ? (
        <SalesEmptyState
          icon={FileText}
          title="Couldn't load quotes"
          description={quotesQuery.error?.message ?? 'Something went wrong. Please try again.'}
          action={
            <button
              type="button"
              onClick={() => void quotesQuery.refetch()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          }
        />
      ) : isLoading ? (
        <QuotesSkeleton />
      ) : quotes.length === 0 ? (
        <SalesEmptyState
          icon={FileText}
          title="No quotes yet"
          description="Create your first quotation from the price book. Track it from draft to accepted, then convert it into a finance invoice in one click."
          action={
            <button
              type="button"
              onClick={() => setBuilder({ mode: 'create' })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> New quote
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={FileText} label="Total quotes" value={String(kpis.total)} />
            <KpiCard icon={Send} label="Sent" value={String(kpis.sent)} hint="Awaiting response" />
            <KpiCard icon={CheckCircle2} label="Accepted" value={String(kpis.accepted)} />
            <KpiCard
              icon={Coins}
              label="Accepted value"
              value={formatCompactCurrency(kpis.acceptedValue)}
              hint="Incl. VAT"
            />
          </div>

          <SalesFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search title, client, or quote #…"
            selects={filterSelects}
            resultCount={filtered.length}
            right={
              <ColumnPickerMenu
                columns={QUOTE_COLUMN_OPTIONS}
                visible={quoteColumns.visible}
                onToggle={quoteColumns.toggle}
                onReset={quoteColumns.reset}
              />
            }
          />

          {filtered.length === 0 ? (
            <SalesEmptyState
              icon={FileText}
              title="No matching quotes"
              description="Try clearing a filter or adjusting your search."
              compact
            />
          ) : (
            <QuotesTable
              quotes={filtered}
              isColumnVisible={quoteColumns.isVisible}
              onOpen={setSelectedId}
            />
          )}
        </div>
      )}

      {selectedId ? (
        <QuoteDetailDrawer
          quoteId={selectedId}
          onClose={() => setSelectedId(null)}
          onEdit={(id) => {
            setSelectedId(null);
            setBuilder({ mode: 'edit', id });
          }}
          onDelete={(q) => {
            setSelectedId(null);
            setDeleteTarget(q);
          }}
        />
      ) : null}

      {builder ? (
        <QuoteBuilderDrawer
          mode={builder.mode}
          quoteId={builder.mode === 'edit' ? builder.id : null}
          onClose={() => setBuilder(null)}
          onSaved={(id) => {
            setBuilder(null);
            setSelectedId(id);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete quote?"
        description={
          deleteTarget
            ? `Delete Q-${String(deleteTarget.quoteNumber).padStart(4, '0')} “${deleteTarget.title}”? This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        tone="danger"
        loading={deleteMutation.isPending}
      />
    </DashboardPage>
  );
}

function ApprovalsInbox({ onOpenQuote }: { onOpenQuote: (id: string) => void }) {
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});
  const approvalsQuery = useSalesResource<{ approvals: ApprovalInboxItem[] }>(
    salesKeys.quoteApprovals(),
    '/api/sales/quotes/approvals',
    { retry: false },
  );

  const decisionMutation = useSalesMutation<
    { approval: { id: string; status: string } },
    { quoteId: string; decision: 'approved' | 'rejected'; reason: string }
  >(
    ({ quoteId, decision, reason }) =>
      apiFetch(`/api/sales/quotes/${quoteId}/approval`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      }),
    {
      invalidateKeys: [salesKeys.all, salesKeys.quoteApprovals(), salesKeys.quotes()],
      onSuccess: (_d, vars) =>
        toast.success(vars.decision === 'approved' ? 'Quote approved — send is unblocked.' : 'Quote rejected.'),
    },
  );

  if (approvalsQuery.isError) {
    const status = (approvalsQuery.error as ApiError | undefined)?.status;
    if (status === 403) {
      return (
        <SalesEmptyState
          icon={ClipboardCheck}
          title="Approvals restricted"
          description="You need the sales.approve_quotes permission to review discount requests."
          compact
        />
      );
    }
    return (
      <SalesEmptyState
        icon={ClipboardCheck}
        title="Couldn't load approvals"
        description={approvalsQuery.error?.message ?? 'Something went wrong.'}
        action={
          <button
            type="button"
            onClick={() => void approvalsQuery.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        }
      />
    );
  }

  if (approvalsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--dash-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading approvals…
      </div>
    );
  }

  const approvals = approvalsQuery.data?.approvals ?? [];
  if (approvals.length === 0) {
    return (
      <SalesEmptyState
        icon={ClipboardCheck}
        title="No pending approvals"
        description="Quotes that exceed the discount policy will appear here for review."
        compact
      />
    );
  }

  return (
    <div className="space-y-3">
      {approvals.map((row) => {
        const quote = row.quote;
        if (!quote) return null;
        const reason = reasonDraft[row.id] ?? '';
        const busy = decisionMutation.isPending;
        return (
          <div
            key={row.id}
            className={`${DASHBOARD_SURFACE_CLASS} flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between`}
          >
            <div className="min-w-0 space-y-1">
              <button
                type="button"
                onClick={() => onOpenQuote(quote.id)}
                className="text-left text-sm font-semibold text-[var(--dash-text-strong)] hover:underline"
              >
                Q-{String(quote.quoteNumber).padStart(4, '0')} · {quote.title}
              </button>
              <p className="text-xs text-[var(--dash-text-muted)]">
                {quote.accountsClient?.name ?? 'No account'} · Requested by {row.requestedBy.name}
                {row.effectiveDiscountPct != null
                  ? ` · Effective discount ${row.effectiveDiscountPct}%`
                  : ''}
              </p>
              <QuoteStatusBadge status={quote.status} />
              <label className="mt-2 block text-xs font-medium text-[var(--dash-text-muted)]">
                Reason (required)
                <textarea
                  value={reason}
                  onChange={(e) =>
                    setReasonDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                  }
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface)] px-3 py-2 text-sm text-[var(--dash-text-strong)]"
                  placeholder="Why approve or reject…"
                />
              </label>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={() =>
                  void decisionMutation
                    .mutateAsync({
                      quoteId: quote.id,
                      decision: 'approved',
                      reason: reason.trim(),
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : 'Approve failed.'))
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
              <button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={() =>
                  void decisionMutation
                    .mutateAsync({
                      quoteId: quote.id,
                      decision: 'rejected',
                      reason: reason.trim(),
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : 'Reject failed.'))
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)] disabled:opacity-60"
              >
                <X className="h-4 w-4" /> Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main list table                                                     */
/* ------------------------------------------------------------------ */

function QuotesTable({
  quotes,
  isColumnVisible,
  onOpen,
}: {
  quotes: QuoteListItem[];
  isColumnVisible: (id: QuoteColumnId) => boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <DashboardTableCard>
      <DashboardTableViewport minWidth={780}>
        <DashboardTable className="dashboard-table-clean">
          <thead>
            <tr>
              {isColumnVisible('quote') ? <th className="col-primary">Quote</th> : null}
              {isColumnVisible('account') ? <th>Account</th> : null}
              {isColumnVisible('status') ? <th>Status</th> : null}
              {isColumnVisible('total') ? <th className="col-right">Total</th> : null}
              {isColumnVisible('validUntil') ? <th>Valid until</th> : null}
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => {
              const quoteLabel = `Q-${String(quote.quoteNumber).padStart(4, '0')}`;
              const quoteTitle = `${quote.title} · ${quoteLabel}`;
              return (
              <tr
                key={quote.id}
                onClick={() => onOpen(quote.id)}
                className="cursor-pointer transition-colors hover:bg-[var(--dash-hover)]"
              >
                {isColumnVisible('quote') ? (
                  <td className="col-primary col-truncate-lg font-medium text-[var(--dash-text-strong)]" title={quoteTitle}>
                    {quote.title} · {quoteLabel}
                  </td>
                ) : null}
                {isColumnVisible('account') ? (
                  <td className="col-muted col-truncate" title={quote.accountsClient?.name ?? undefined}>
                    {quote.accountsClient?.name ?? '—'}
                  </td>
                ) : null}
                {isColumnVisible('status') ? (
                  <td>
                    <div className="inline-flex flex-nowrap whitespace-nowrap">
                      <QuoteStatusBadge status={quote.status} />
                    </div>
                  </td>
                ) : null}
                {isColumnVisible('total') ? (
                  <td className="col-right tabular-nums text-[var(--dash-text-strong)]">
                    {formatSalesCurrency(quote.totals.total, quote.currency)}
                  </td>
                ) : null}
                {isColumnVisible('validUntil') ? (
                  <td className="col-muted">{formatShortDate(quote.validUntil)}</td>
                ) : null}
              </tr>
              );
            })}
          </tbody>
        </DashboardTable>
      </DashboardTableViewport>
    </DashboardTableCard>
  );
}

/* ------------------------------------------------------------------ */
/* Detail drawer                                                       */
/* ------------------------------------------------------------------ */

function QuoteDetailDrawer({
  quoteId,
  onClose,
  onEdit,
  onDelete,
}: {
  quoteId: string;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDelete: (quote: QuoteListItem) => void;
}) {
  const detailQuery = useSalesResource<{ quote: QuoteDetail }>(
    salesKeys.quote(quoteId),
    `/api/sales/quotes/${quoteId}`,
  );
  const quote = detailQuery.data?.quote ?? null;

  const [convertOpen, setConvertOpen] = useState(false);

  const statusMutation = useSalesMutation<{ quote: QuoteDetail }, string>(
    (status) =>
      apiFetch(`/api/sales/quotes/${quoteId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    {
      invalidateKeys: [salesKeys.all, salesKeys.quote(quoteId), salesKeys.quoteApprovals()],
      onSuccess: (_d, status) => toast.success(`Quote marked ${status}.`),
    },
  );

  const convertMutation = useSalesMutation<
    { result: { invoiceNumber: number } },
    void
  >(
    () => apiFetch(`/api/sales/quotes/${quoteId}/convert-to-invoice`, { method: 'POST' }),
    {
      invalidateKeys: [salesKeys.all, salesKeys.quote(quoteId)],
    },
  );

  const changeStatus = useCallback(
    async (status: string) => {
      try {
        await statusMutation.mutateAsync(status);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          toast.info(e.message || 'Quote submitted for approval.');
          // Refetch so drawer shows pending_approval
          void detailQuery.refetch();
          return;
        }
        toast.error(e instanceof Error ? e.message : 'Update failed.');
      }
    },
    [statusMutation, detailQuery],
  );

  async function handleConvert() {
    try {
      const res = await convertMutation.mutateAsync();
      setConvertOpen(false);
      toast.success(`Invoice #${res.result.invoiceNumber} created in Finance.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Conversion failed.');
    }
  }

  function downloadPdf() {
    window.open(`/api/sales/quotes/${quoteId}/pdf`, '_blank', 'noopener,noreferrer');
  }

  const busy = statusMutation.isPending;

  return (
    <SalesDrawer
      open
      onClose={onClose}
      width="xl"
      title={quote ? quote.title : 'Quote'}
      subtitle={quote ? `Q-${String(quote.quoteNumber).padStart(4, '0')}` : undefined}
      footer={
        quote ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {quote.status === 'draft' || quote.status === 'pending_approval' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void changeStatus('sent')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {quote.status === 'pending_approval' ? 'Send (if approved)' : 'Send'}
                </button>
              ) : null}
              {quote.status === 'sent' ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void changeStatus('accepted')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void changeStatus('rejected')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)] disabled:opacity-60"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                </>
              ) : null}
              {quote.status === 'accepted' && quote.accountsInvoiceId ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <Receipt className="h-4 w-4" /> Invoiced
                </span>
              ) : quote.status === 'accepted' ? (
                <button
                  type="button"
                  disabled={convertMutation.isPending}
                  onClick={() => setConvertOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {convertMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4" />
                  )}
                  Convert to invoice
                </button>
              ) : null}
              {quote.status === 'rejected' || quote.status === 'expired' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void changeStatus('draft')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)] disabled:opacity-60"
                >
                  Reopen
                </button>
              ) : null}
              {quote.status === 'draft' || quote.status === 'sent' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void changeStatus('expired')}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] disabled:opacity-60"
                >
                  Expire
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadPdf}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)]"
              >
                <Download className="h-4 w-4" /> PDF
              </button>
              <button
                type="button"
                onClick={() => onEdit(quote.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)]"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
            </div>
          </div>
        ) : null
      }
    >
      {detailQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-5 w-full animate-pulse rounded bg-[var(--dash-border)]" />
          ))}
        </div>
      ) : detailQuery.isError || !quote ? (
        <p className="text-sm text-rose-600">
          {detailQuery.error?.message ?? 'Could not load this quote.'}
        </p>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <QuoteStatusBadge status={quote.status} />
            <span className="text-xs text-[var(--dash-text-muted)]">
              Issued {formatShortDate(quote.issueDate)}
            </span>
            {quote.validUntil ? (
              <span className="text-xs text-[var(--dash-text-muted)]">
                · Valid until {formatShortDate(quote.validUntil)}
              </span>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <Field label="Account" value={quote.accountsClient?.name ?? null} />
            <Field label="Linked deal" value={quote.deal?.name ?? null} />
            <Field label="Discount" value={quote.discountPct ? `${quote.discountPct}%` : 'None'} />
            <Field label="VAT" value={`${(quote.taxRateBps / 100).toFixed(0)}%`} />
            <Field label="Prepared by" value={quote.createdBy?.name ?? null} />
            <Field label="Currency" value={quote.currency} />
          </dl>

          <div className={`overflow-hidden rounded-xl border border-[var(--dash-border)]`}>
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
                <tr>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-[var(--dash-text-muted)]">
                      No line items yet — edit the quote to add products.
                    </td>
                  </tr>
                ) : (
                  quote.lineItems.map((li) => {
                    const recurringHint = li.isRecurring
                      ? `Recurring · ${li.termMonths ?? 1} mo${li.discountPct ? ` · -${li.discountPct}%` : ''}`
                      : li.discountPct
                        ? `-${li.discountPct}%`
                        : null;
                    const descTitle = recurringHint
                      ? `${li.description} · ${recurringHint}`
                      : li.description;
                    return (
                    <tr key={li.id} className="border-t border-[var(--dash-border)]">
                      <td className="max-w-[16rem] truncate whitespace-nowrap px-3 py-2 text-[var(--dash-text-strong)]" title={descTitle}>
                        {li.description}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[var(--dash-text-muted)]">
                        {li.quantity}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[var(--dash-text-muted)]">
                        {formatSalesCurrency(li.unitPrice, quote.currency)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[var(--dash-text-strong)]">
                        {formatSalesCurrency(
                          extendedAmount({
                            quantity: li.quantity,
                            unitPrice: li.unitPrice,
                            discountPct: li.discountPct,
                            isRecurring: li.isRecurring,
                            termMonths: li.termMonths,
                          }),
                          quote.currency,
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <TotalsPanel totals={quote.totals} currency={quote.currency} taxRateBps={quote.taxRateBps} />

          {quote.notes ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                Notes
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--dash-text-strong)]">{quote.notes}</p>
            </div>
          ) : null}
          {quote.terms ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                Terms
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--dash-text-strong)]">{quote.terms}</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => onDelete(quote)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete quote
          </button>
        </div>
      )}

      <ConfirmDialog
        open={convertOpen}
        title="Convert quote to invoice?"
        description={
          quote
            ? `A finance invoice will be created for ${quote.accountsClient?.name ?? 'the client'} totalling ${formatSalesCurrency(quote.totals.total, quote.currency)} (incl. VAT).`
            : undefined
        }
        confirmLabel="Create invoice"
        loading={convertMutation.isPending}
        onConfirm={() => void handleConvert()}
        onCancel={() => setConvertOpen(false)}
      />
    </SalesDrawer>
  );
}

function TotalsPanel({
  totals,
  currency,
  taxRateBps,
}: {
  totals: Totals;
  currency: string;
  taxRateBps: number;
}) {
  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
      <dl className="space-y-1.5 text-sm">
        <Row label="Subtotal" value={formatSalesCurrency(totals.subtotal, currency)} />
        {totals.discountAmount > 0 ? (
          <Row label="Discount" value={`- ${formatSalesCurrency(totals.discountAmount, currency)}`} />
        ) : null}
        <Row label={`VAT (${(taxRateBps / 100).toFixed(0)}%)`} value={formatSalesCurrency(totals.taxAmount, currency)} />
        <div className="mt-1 border-t border-[var(--dash-border)] pt-2">
          <Row
            label="Total"
            value={formatSalesCurrency(totals.total, currency)}
            strong
          />
        </div>
      </dl>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? 'font-semibold text-[var(--dash-text-strong)]' : 'text-[var(--dash-text-muted)]'}>
        {label}
      </dt>
      <dd
        className={`tabular-nums ${strong ? 'text-base font-semibold text-[var(--dash-text-strong)]' : 'text-[var(--dash-text-strong)]'}`}
      >
        {value}
      </dd>
    </div>
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

/* ------------------------------------------------------------------ */
/* Builder drawer (create / edit)                                      */
/* ------------------------------------------------------------------ */

let tempCounter = 0;
const nextTempId = () => `tmp-${++tempCounter}`;

function QuoteBuilderDrawer({
  mode,
  quoteId,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  quoteId: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const clientsQuery = useSalesResource<{ clients: ClientOpt[] }>(
    ['accounts', 'clients', 'sales-quote-builder'],
    '/api/accounts/clients',
  );
  const dealsQuery = useSalesResource<{ deals: DealOpt[] }>(
    salesKeys.deals({ scope: 'quote-builder' }),
    '/api/sales/deals',
  );
  const productsQuery = useSalesResource<{ products: ProductOpt[]; canViewMargin?: boolean }>(
    salesKeys.products({ scope: 'quote-builder' }),
    '/api/sales/products?active=true',
  );
  const detailQuery = useSalesResource<{ quote: QuoteDetail }>(
    salesKeys.quote(quoteId ?? 'new'),
    `/api/sales/quotes/${quoteId}`,
    { enabled: mode === 'edit' && Boolean(quoteId) },
  );

  const clients = clientsQuery.data?.clients ?? [];
  const deals = dealsQuery.data?.deals ?? [];
  const products = useMemo(() => productsQuery.data?.products ?? [], [productsQuery.data]);
  const canViewMargin =
    productsQuery.data?.canViewMargin === true || detailQuery.data?.quote?.canViewMargin === true;

  const loadedQuote = mode === 'edit' ? detailQuery.data?.quote ?? null : null;

  const [initialized, setInitialized] = useState(mode === 'create');
  const [title, setTitle] = useState('');
  const [accountsClientId, setAccountsClientId] = useState('');
  const [dealId, setDealId] = useState('');
  const [currency, setCurrency] = useState('KES');
  const [validUntil, setValidUntil] = useState('');
  const [discountPct, setDiscountPct] = useState('0');
  const [taxRateBps, setTaxRateBps] = useState('1600');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [originalLines, setOriginalLines] = useState<Array<Omit<LineItem, 'tempId'>>>([]);
  const [saving, setSaving] = useState(false);

  // Hydrate the form once the quote detail arrives (edit mode).
  if (mode === 'edit' && loadedQuote && !initialized) {
    setTitle(loadedQuote.title);
    setAccountsClientId(loadedQuote.accountsClientId ?? '');
    setDealId(loadedQuote.dealId ?? '');
    setCurrency(loadedQuote.currency);
    setValidUntil(loadedQuote.validUntil ? loadedQuote.validUntil.slice(0, 10) : '');
    setDiscountPct(String(loadedQuote.discountPct));
    setTaxRateBps(String(loadedQuote.taxRateBps));
    setNotes(loadedQuote.notes ?? '');
    setTerms(loadedQuote.terms ?? '');
    setLines(loadedQuote.lineItems.map((li) => ({ ...li, tempId: nextTempId() })));
    setOriginalLines(loadedQuote.lineItems);
    setInitialized(true);
  }

  const totals = useMemo(
    () => computeTotals(lines, Number(discountPct) || 0, Number(taxRateBps) || 0),
    [lines, discountPct, taxRateBps],
  );

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        tempId: nextTempId(),
        productId: null,
        product: null,
        description: '',
        quantity: 1,
        unitPrice: 0,
        discountPct: 0,
        priceOverridden: false,
        listPrice: null,
        isRecurring: false,
        termMonths: null,
        sortOrder: prev.length,
      },
    ]);
  }

  function updateLine(tempId: string, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l) => (l.tempId === tempId ? { ...l, ...patch } : l)));
  }

  function removeLine(tempId: string) {
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  }

  async function resolveListPrice(productId: string, quantity: number) {
    try {
      const res = await apiFetch<{
        resolved: { unitPrice: number; minQty: number } | null;
      }>(
        `/api/sales/price-books?resolveProductId=${encodeURIComponent(productId)}&qty=${quantity}`,
      );
      return res.resolved?.unitPrice ?? null;
    } catch {
      return null;
    }
  }

  async function selectProduct(tempId: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      updateLine(tempId, { productId: null, listPrice: null, priceOverridden: false });
      return;
    }
    const line = lines.find((l) => l.tempId === tempId);
    const qty = line?.quantity ?? 1;
    const listPrice = (await resolveListPrice(product.id, qty)) ?? product.unitPrice;
    updateLine(tempId, {
      productId: product.id,
      product: { id: product.id, name: product.name, sku: product.sku },
      description: product.name,
      unitPrice: listPrice,
      listPrice,
      priceOverridden: false,
      costPrice: product.costPrice ?? null,
      margin:
        product.costPrice != null
          ? Math.round((listPrice - product.costPrice) * 100) / 100
          : null,
      isRecurring: product.isRecurring,
      termMonths: product.isRecurring ? product.defaultTermMonths : null,
    });
  }

  async function onQuantityChange(tempId: string, quantity: number) {
    const line = lines.find((l) => l.tempId === tempId);
    if (!line) return;
    if (!line.productId || line.priceOverridden) {
      updateLine(tempId, { quantity });
      return;
    }
    const listPrice = await resolveListPrice(line.productId, quantity);
    if (listPrice == null) {
      updateLine(tempId, { quantity });
      return;
    }
    updateLine(tempId, {
      quantity,
      unitPrice: listPrice,
      listPrice,
      margin:
        line.costPrice != null
          ? Math.round((listPrice - line.costPrice) * 100) / 100
          : line.margin ?? null,
    });
  }

  function onUnitPriceChange(tempId: string, unitPrice: number) {
    const line = lines.find((l) => l.tempId === tempId);
    const listPrice = line?.listPrice;
    const overridden =
      listPrice != null ? Math.abs(unitPrice - listPrice) > 0.005 : true;
    updateLine(tempId, {
      unitPrice,
      priceOverridden: overridden,
      margin:
        line?.costPrice != null
          ? Math.round((unitPrice - line.costPrice) * 100) / 100
          : null,
    });
  }

  const canSave =
    title.trim().length > 0 &&
    lines.every((l) => l.description.trim().length > 0) &&
    !saving;

  function serializeLine(l: LineItem) {
    return {
      productId: l.productId,
      description: l.description.trim(),
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      priceOverridden: l.priceOverridden === true,
      isRecurring: l.isRecurring,
      termMonths: l.isRecurring ? l.termMonths : null,
    };
  }

  function lineChanged(orig: Omit<LineItem, 'tempId'>, cur: LineItem) {
    return (
      orig.description !== cur.description.trim() ||
      orig.quantity !== cur.quantity ||
      orig.unitPrice !== cur.unitPrice ||
      orig.discountPct !== cur.discountPct ||
      orig.isRecurring !== cur.isRecurring ||
      (orig.termMonths ?? null) !== (cur.isRecurring ? cur.termMonths ?? null : null) ||
      (orig.productId ?? null) !== (cur.productId ?? null)
    );
  }

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    const header = {
      title: title.trim(),
      accountsClientId: accountsClientId || null,
      dealId: dealId || null,
      currency: currency.trim() || 'KES',
      discountPct: Number(discountPct) || 0,
      taxRateBps: Number(taxRateBps) || 0,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
      validUntil: validUntil || null,
    };

    try {
      if (mode === 'create') {
        const res = await apiFetch<{ quote: { id: string } }>('/api/sales/quotes', {
          method: 'POST',
          body: JSON.stringify({ ...header, lineItems: lines.map(serializeLine) }),
        });
        toast.success('Quote created.');
        onSaved(res.quote.id);
        return;
      }

      // Edit: patch header, then reconcile line items via add/delete.
      if (!quoteId) return;
      await apiFetch(`/api/sales/quotes/${quoteId}`, {
        method: 'PATCH',
        body: JSON.stringify(header),
      });

      const toAdd: LineItem[] = [];
      for (const orig of originalLines) {
        const cur = lines.find((l) => l.id === orig.id);
        if (!cur) {
          await apiFetch(`/api/sales/quotes/${quoteId}/line-items?lineItemId=${orig.id}`, {
            method: 'DELETE',
          });
        } else if (lineChanged(orig, cur)) {
          await apiFetch(`/api/sales/quotes/${quoteId}/line-items?lineItemId=${orig.id}`, {
            method: 'DELETE',
          });
          toAdd.push(cur);
        }
      }
      for (const cur of lines.filter((l) => !l.id)) toAdd.push(cur);
      for (const line of toAdd) {
        await apiFetch(`/api/sales/quotes/${quoteId}/line-items`, {
          method: 'POST',
          body: JSON.stringify(serializeLine(line)),
        });
      }

      toast.success('Quote updated.');
      onSaved(quoteId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const loading = mode === 'edit' && (detailQuery.isLoading || !initialized);

  return (
    <SalesDrawer
      open
      onClose={onClose}
      width="xl"
      title={mode === 'edit' ? 'Edit quote' : 'New quote'}
      subtitle="Pick a client, add line items, and review the totals before saving."
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--dash-text-strong)]">
            Total: {formatSalesCurrency(totals.total, currency)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSave || loading}
              onClick={() => void submit()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'edit' ? 'Save changes' : 'Create quote'}
            </button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-full animate-pulse rounded bg-[var(--dash-border)]" />
          ))}
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <FormField label="Title" required>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 logistics proposal"
              className="dash-auth-input w-full"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Account">
              <StrideSelect
                value={accountsClientId}
                onChange={(v) => {
                  setAccountsClientId(v);
                  const c = clients.find((x) => x.id === v);
                  if (c?.currency) setCurrency(c.currency);
                }}
                ariaLabel="Account"
                className="w-full"
                placeholder={clientsQuery.isLoading ? 'Loading…' : 'Select client'}
                options={[
                  { value: '', label: 'No account' },
                  ...clients.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </FormField>
            <FormField label="Linked deal (optional)">
              <StrideSelect
                value={dealId}
                onChange={(v) => {
                  setDealId(v);
                  const d = deals.find((x) => x.id === v);
                  if (d) {
                    if (d.accountsClientId) setAccountsClientId(d.accountsClientId);
                    if (d.currency) setCurrency(d.currency);
                  }
                }}
                ariaLabel="Linked deal"
                className="w-full"
                placeholder={dealsQuery.isLoading ? 'Loading…' : 'No deal'}
                options={[
                  { value: '', label: 'No deal' },
                  ...deals.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Valid until">
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="dash-auth-input w-full"
              />
            </FormField>
            <FormField label="Discount %">
              <input
                type="number"
                min={0}
                max={100}
                step="any"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="dash-auth-input w-full"
              />
            </FormField>
            <FormField label="VAT %">
              <input
                type="number"
                min={0}
                step="any"
                value={(Number(taxRateBps) / 100).toString()}
                onChange={(e) => setTaxRateBps(String(Math.round((Number(e.target.value) || 0) * 100)))}
                className="dash-auth-input w-full"
              />
            </FormField>
          </div>

          {/* Line items */}
          <div className="rounded-xl border border-[var(--dash-border)]">
            <div className="flex items-center justify-between border-b border-[var(--dash-border)] px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
                Line items
              </span>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--dash-border)] px-2 py-1 text-xs font-medium text-[var(--dash-text-strong)] hover:bg-[var(--dash-hover)]"
              >
                <Plus className="h-3.5 w-3.5" /> Add line
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[var(--dash-text-muted)]">
                No line items yet. Add a product or a custom line.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--dash-border)]">
                {lines.map((line) => (
                  <li key={line.tempId} className="space-y-2 p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <StrideSelect
                          value={line.productId ?? ''}
                          onChange={(v) => void selectProduct(line.tempId, v)}
                          ariaLabel="Product"
                          className="w-full"
                          placeholder="Custom line (no product)"
                          options={[
                            { value: '', label: 'Custom line (no product)' },
                            ...products.map((p) => ({
                              value: p.id,
                              label: `${p.name}${p.sku ? ` · ${p.sku}` : ''}`,
                            })),
                          ]}
                        />
                        <input
                          value={line.description}
                          onChange={(e) => updateLine(line.tempId, { description: e.target.value })}
                          placeholder="Description"
                          className="dash-auth-input w-full"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.tempId)}
                        aria-label="Remove line"
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <NumberField
                        label="Qty"
                        value={line.quantity}
                        min={0}
                        onChange={(n) => void onQuantityChange(line.tempId, n)}
                      />
                      <NumberField
                        label="Unit price"
                        value={line.unitPrice}
                        min={0}
                        onChange={(n) => onUnitPriceChange(line.tempId, n)}
                      />
                      <NumberField
                        label="Disc %"
                        value={line.discountPct}
                        min={0}
                        max={100}
                        onChange={(n) => updateLine(line.tempId, { discountPct: n })}
                      />
                      <div className="flex flex-col justify-end">
                        <span className="mb-1 block text-[11px] text-[var(--dash-text-muted)]">
                          Line total
                        </span>
                        <span className="tabular-nums text-sm font-medium text-[var(--dash-text-strong)]">
                          {formatSalesCurrency(extendedAmount(line), currency)}
                        </span>
                      </div>
                    </div>

                    {line.priceOverridden || (canViewMargin && line.margin != null) ? (
                      <div className="flex flex-wrap gap-3 text-[11px] text-[var(--dash-text-muted)]">
                        {line.priceOverridden ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                            Price overridden
                          </span>
                        ) : null}
                        {canViewMargin && line.margin != null ? (
                          <span>
                            Margin: {formatSalesCurrency(line.margin, currency)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-[var(--dash-text-strong)]">
                        <input
                          type="checkbox"
                          checked={line.isRecurring}
                          onChange={(e) =>
                            updateLine(line.tempId, {
                              isRecurring: e.target.checked,
                              termMonths: e.target.checked ? line.termMonths ?? 12 : null,
                            })
                          }
                          className="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--stride-coral)] focus:ring-[var(--stride-coral)]/30"
                        />
                        Recurring
                      </label>
                      {line.isRecurring ? (
                        <label className="flex items-center gap-2 text-xs text-[var(--dash-text-muted)]">
                          Term (months)
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={line.termMonths ?? ''}
                            onChange={(e) =>
                              updateLine(line.tempId, {
                                termMonths: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            className="dash-auth-input w-20"
                          />
                        </label>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <TotalsPanel totals={totals} currency={currency} taxRateBps={Number(taxRateBps) || 0} />

          <div className="grid grid-cols-1 gap-3">
            <FormField label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="dash-auth-input w-full"
              />
            </FormField>
            <FormField label="Terms & conditions">
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={2}
                className="dash-auth-input w-full"
              />
            </FormField>
          </div>
        </form>
      )}
    </SalesDrawer>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-[var(--dash-text-muted)]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step="any"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className="dash-auth-input w-full"
      />
    </label>
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

function QuotesSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
