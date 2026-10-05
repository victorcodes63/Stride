'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Focus,
  List,
  Loader2,
} from 'lucide-react';
import { DashboardPage, DashboardPageHeader } from '@/components/dashboard/DashboardPage';
import { DashboardPageSkeleton } from '@/components/dashboard/DashboardAsyncState';
import { StrideButton } from '@/components/ui/stride-button';
import type {
  AttentionAction,
  AttentionActionKind,
  AttentionQueueId,
  AttentionQueueSummary,
  AttentionWorkItem,
} from '@/lib/dashboard-attention/work-items';

type AttentionResponse = {
  summary: AttentionQueueSummary;
  items: AttentionWorkItem[];
  hasMoreByQueue?: Partial<Record<AttentionQueueId, boolean>>;
  error?: string;
};

function toneClasses(tone: AttentionWorkItem['tone']) {
  if (tone === 'rose') {
    return {
      bar: 'bg-rose-500',
      chip: 'bg-rose-100 text-rose-800 dark:bg-rose-950/55 dark:text-rose-200',
    };
  }
  if (tone === 'amber') {
    return {
      bar: 'bg-amber-500',
      chip: 'bg-amber-100 text-amber-900 dark:bg-amber-950/55 dark:text-amber-200',
    };
  }
  if (tone === 'sky') {
    return {
      bar: 'bg-sky-500',
      chip: 'bg-sky-100 text-sky-900 dark:bg-sky-950/55 dark:text-sky-200',
    };
  }
  return {
    bar: 'bg-[var(--dash-border)]',
    chip: 'bg-[var(--dash-surface-muted)] text-[var(--dash-text-muted)]',
  };
}

function ActionForm({
  item,
  action,
  busy,
  onCancel,
  onSubmit,
}: {
  item: AttentionWorkItem;
  action: AttentionAction;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    note?: string;
    payment?: { amount: number; method: string; receivedAt: string; reference?: string };
  }) => void;
}) {
  const amountDue = Number(item.meta?.amountDue ?? 0);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState(amountDue > 0 ? String(amountDue) : '');
  const [method, setMethod] = useState('bank_transfer');
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)]/40 p-4">
      <p className="text-sm font-semibold text-[var(--dash-text-strong)]">{action.label}</p>
      {action.requiresPayment ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[var(--dash-text-muted)]">
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-[var(--dash-input-border)] bg-[var(--dash-input-bg)] px-3 py-2 text-sm text-[var(--dash-text-strong)]"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-[var(--dash-text-muted)]">
            Date
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-[var(--dash-input-border)] bg-[var(--dash-input-bg)] px-3 py-2 text-sm text-[var(--dash-text-strong)]"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-[var(--dash-text-muted)]">
            Method
            <select
              className="mt-1 w-full rounded-lg border border-[var(--dash-input-border)] bg-[var(--dash-input-bg)] px-3 py-2 text-sm text-[var(--dash-text-strong)]"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="mpesa">M-Pesa</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-[var(--dash-text-muted)]">
            Reference
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-[var(--dash-input-border)] bg-[var(--dash-input-bg)] px-3 py-2 text-sm text-[var(--dash-text-strong)]"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
      ) : null}
      {action.requiresNote || action.requiresPayment ? (
        <label className="block text-xs font-medium text-[var(--dash-text-muted)]">
          {action.requiresNote ? 'Note / reason' : 'Notes (optional)'}
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--dash-input-border)] bg-[var(--dash-input-bg)] px-3 py-2 text-sm text-[var(--dash-text-strong)]"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={action.requiresNote ? 'Required for this action' : 'Optional'}
          />
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <StrideButton
          type="button"
          variant={action.variant === 'secondary' || action.variant === 'danger' ? 'secondary' : 'primary'}
          disabled={busy || (action.requiresNote && !note.trim())}
          className={action.variant === 'danger' ? '!bg-rose-600 !text-white hover:!bg-rose-700' : undefined}
          onClick={() =>
            onSubmit({
              note: note.trim() || undefined,
              payment: action.requiresPayment
                ? {
                    amount: Number(amount),
                    method,
                    receivedAt,
                    reference: reference.trim() || undefined,
                  }
                : undefined,
            })
          }
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirm {action.label.toLowerCase()}
        </StrideButton>
        <StrideButton type="button" variant="secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </StrideButton>
      </div>
    </div>
  );
}

export function ActionCenterPage() {
  const searchParams = useSearchParams();
  const typeFilter = searchParams.get('type') as AttentionQueueId | null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AttentionWorkItem[]>([]);
  const [summary, setSummary] = useState<AttentionQueueSummary>({ total: 0, critical: 0, byQueue: {} });
  const [mode, setMode] = useState<'focus' | 'list'>('list');
  const [focusIndex, setFocusIndex] = useState(0);
  const [pendingAction, setPendingAction] = useState<AttentionAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = typeFilter ? `?type=${encodeURIComponent(typeFilter)}` : '';
      const res = await fetch(`/api/dashboard/attention${qs}`, { cache: 'no-store' });
      const data = (await res.json()) as AttentionResponse;
      if (!res.ok) throw new Error(data.error || 'Failed to load queue');
      setItems(data.items ?? []);
      setSummary(data.summary ?? { total: 0, critical: 0, byQueue: {} });
      setFocusIndex(0);
      setPendingAction(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = items[focusIndex] ?? null;

  const runAction = useCallback(
    async (
      item: AttentionWorkItem,
      actionId: AttentionActionKind,
      payload?: {
        note?: string;
        payment?: { amount: number; method: string; receivedAt: string; reference?: string };
      },
    ) => {
      setBusy(true);
      setFlash(null);
      try {
        const res = await fetch('/api/dashboard/attention/actions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            queueId: item.queueId,
            entityId: item.entityId,
            action: actionId,
            note: payload?.note,
            payment: payload?.payment,
            meta: item.meta,
            clientId: item.meta?.clientId,
            vendorId: item.meta?.vendorId,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || 'Action failed');

        setFlash(`Cleared: ${item.title}`);
        setPendingAction(null);
        setItems((prev) => {
          const next = prev.filter((x) => x.id !== item.id);
          setFocusIndex((idx) => Math.min(idx, Math.max(0, next.length - 1)));
          setSummary({
            total: next.length,
            critical: next.filter((x) => x.tone === 'rose').length,
            byQueue: next.reduce<Partial<Record<AttentionQueueId, number>>>((acc, x) => {
              acc[x.queueId] = (acc[x.queueId] ?? 0) + 1;
              return acc;
            }, {}),
          });
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Action failed');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AttentionWorkItem[]>();
    for (const item of items) {
      const key = item.domainId;
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [items]);

  if (loading) {
    return (
      <DashboardPage>
        <DashboardPageSkeleton />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Action Center"
        description="Scan every pending queue, then clear items inline — or switch to Focus to work one at a time."
        actions={
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-2"
            onClick={() => {
              setPendingAction(null);
              setMode((m) => (m === 'focus' ? 'list' : 'focus'));
            }}
          >
            {mode === 'list' ? <Focus className="h-4 w-4" /> : <List className="h-4 w-4" />}
            {mode === 'list' ? 'Focus mode' : 'List view'}
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          {summary.total} open
        </span>
        {summary.critical > 0 ? (
          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
            {summary.critical} critical
          </span>
        ) : null}
        {typeFilter ? (
          <Link
            href="/dashboard/attention"
            className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"
          >
            Clear filter ({typeFilter})
          </Link>
        ) : null}
      </div>

      {flash ? (
        <p className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button
            type="button"
            className="ml-auto text-xs font-semibold underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </p>
      ) : null}

      {error && items.length === 0 ? (
        <section className="dashboard-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-rose-500" />
          <h2 className="text-lg font-semibold text-[var(--dash-text-strong)]">Couldn’t load queues</h2>
          <p className="max-w-md text-sm text-[var(--dash-text-muted)]">
            The Action Center couldn’t fetch pending items. Try again in a moment.
          </p>
          <button
            type="button"
            className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"
            onClick={() => void load()}
          >
            Retry
          </button>
        </section>
      ) : items.length === 0 ? (
        <section className="dashboard-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <h2 className="text-lg font-semibold text-[var(--dash-text-strong)]">You’re clear</h2>
          <p className="max-w-md text-sm text-[var(--dash-text-muted)]">
            No operational items need attention right now. Personal tasks stay in My work.
          </p>
          <Link
            href="/dashboard/my-tasks"
            className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-400"
          >
            Open My work
          </Link>
        </section>
      ) : mode === 'focus' && current ? (
        <section className="dashboard-panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--dash-border-subtle)] px-4 py-3 sm:px-5">
            <p className="text-sm font-medium tabular-nums text-[var(--dash-text-muted)]">
              {focusIndex + 1} of {items.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-lg p-2 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] disabled:opacity-40"
                disabled={focusIndex <= 0 || busy}
                onClick={() => {
                  setPendingAction(null);
                  setFocusIndex((i) => Math.max(0, i - 1));
                }}
                aria-label="Previous item"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] disabled:opacity-40"
                disabled={focusIndex >= items.length - 1 || busy}
                onClick={() => {
                  setPendingAction(null);
                  setFocusIndex((i) => Math.min(items.length - 1, i + 1));
                }}
                aria-label="Next item"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative px-5 py-5 sm:px-6">
            <span
              className={`absolute inset-y-4 left-0 w-1 rounded-full ${toneClasses(current.tone).bar}`}
              aria-hidden
            />
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-subtle)]">
              {current.queueId.replace(/-/g, ' ')}
            </p>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--dash-text-strong)] sm:text-xl">
              {current.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--dash-text-muted)]">{current.detail}</p>

            {!pendingAction ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {current.actions.map((action) => (
                  <StrideButton
                    key={action.id}
                    type="button"
                    variant={
                      action.variant === 'secondary' || action.variant === 'danger'
                        ? 'secondary'
                        : 'primary'
                    }
                    className={
                      action.variant === 'danger' ? '!bg-rose-600 !text-white hover:!bg-rose-700' : undefined
                    }
                    disabled={busy}
                    onClick={() => {
                      if (action.requiresNote || action.requiresPayment) {
                        setPendingAction(action);
                      } else {
                        void runAction(current, action.id);
                      }
                    }}
                  >
                    {action.label}
                  </StrideButton>
                ))}
                <Link
                  href={current.href}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text-strong)]"
                >
                  Open in module
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <ActionForm
                item={current}
                action={pendingAction}
                busy={busy}
                onCancel={() => setPendingAction(null)}
                onSubmit={(payload) => void runAction(current, pendingAction.id, payload)}
              />
            )}
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          {grouped.map(([domainId, domainItems]) => (
            <section key={domainId} className="dashboard-panel overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--dash-border-subtle)] px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold capitalize text-[var(--dash-text-strong)]">
                  {domainId.replace(/-/g, ' ')}
                </h2>
                <span className="text-sm tabular-nums text-[var(--dash-text-muted)]">
                  {domainItems.length}
                </span>
              </div>
              <ul className="divide-y divide-[var(--dash-border-subtle)]">
                {domainItems.map((item) => {
                  const accent = toneClasses(item.tone);
                  const isExpanded = pendingAction != null && items[focusIndex]?.id === item.id;
                  return (
                    <li key={item.id} className="px-4 py-3 sm:px-5">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1.5 h-8 w-1 shrink-0 rounded-full ${accent.bar}`} />
                        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1 pr-0 sm:pr-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="min-w-0 break-words text-sm font-semibold text-[var(--dash-text-strong)]">
                                {item.title}
                              </p>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${accent.chip}`}
                              >
                                {item.queueId.replace(/-/g, ' ')}
                              </span>
                            </div>
                            <p className="mt-1 break-words text-sm text-[var(--dash-text-muted)]">
                              {item.detail}
                            </p>
                          </div>

                          {!isExpanded ? (
                            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:max-w-[min(100%,22rem)] sm:justify-end">
                              {item.actions.slice(0, 2).map((action) => (
                                <StrideButton
                                  key={action.id}
                                  type="button"
                                  size="sm"
                                  variant={
                                    action.variant === 'secondary' || action.variant === 'danger'
                                      ? 'secondary'
                                      : 'primary'
                                  }
                                  className={
                                    action.variant === 'danger'
                                      ? '!bg-rose-600 !text-white hover:!bg-rose-700'
                                      : undefined
                                  }
                                  disabled={busy}
                                  onClick={() => {
                                    const idx = items.findIndex((x) => x.id === item.id);
                                    if (idx >= 0) setFocusIndex(idx);
                                    if (action.requiresNote || action.requiresPayment) {
                                      setPendingAction(action);
                                    } else {
                                      void runAction(item, action.id);
                                    }
                                  }}
                                >
                                  {action.label}
                                </StrideButton>
                              ))}
                              <Link
                                href={item.href}
                                className="inline-flex items-center gap-1 px-2 py-1.5 text-sm font-medium text-[var(--dash-text-muted)] hover:text-primary-700 dark:hover:text-primary-400"
                              >
                                Open
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {isExpanded ? (
                        <div className="mt-3 pl-4 sm:pl-5">
                          <ActionForm
                            item={item}
                            action={pendingAction!}
                            busy={busy}
                            onCancel={() => setPendingAction(null)}
                            onSubmit={(payload) => void runAction(item, pendingAction!.id, payload)}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
