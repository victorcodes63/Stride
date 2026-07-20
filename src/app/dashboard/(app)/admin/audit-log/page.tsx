'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, History } from 'lucide-react';
import type { AuditEventSummary } from '@/types/dashboard';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableToolbar,
  DashboardTableViewport,
  dashboardTableSelectClass,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { StrideSelect } from '@/components/ui/stride-select';
import {
  auditActionTone,
  describeAuditAction,
  describeEntityReference,
  describeEntityType,
  describeMetadata,
  type AuditTone,
} from '@/lib/audit-format';

const TONE_BADGE_CLASS: Record<AuditTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  read: 'bg-sky-50 text-sky-700 ring-sky-200',
  create: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  update: 'bg-amber-50 text-amber-700 ring-amber-200',
  delete: 'bg-rose-50 text-rose-700 ring-rose-200',
  auth: 'bg-violet-50 text-violet-700 ring-violet-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
};

function TechRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-xs text-neutral-500">{label}:</dt>
      <dd className={`min-w-0 break-all text-xs text-neutral-700 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

function formatWhen(iso: string): { primary: string; secondary: string } {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  let primary: string;
  if (diffMin < 1) primary = 'Just now';
  else if (diffMin < 60) primary = `${diffMin} min ago`;
  else if (diffMin < 60 * 24) primary = `${Math.round(diffMin / 60)} hr ago`;
  else if (diffMin < 60 * 24 * 7) primary = `${Math.round(diffMin / (60 * 24))} day${Math.round(diffMin / (60 * 24)) === 1 ? '' : 's'} ago`;
  else primary = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return {
    primary,
    secondary: date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyTechnical = async (row: AuditEventSummary) => {
    const payload = {
      id: row.id,
      timestamp: row.createdAt,
      actor: row.actorNameOrEmail,
      actorUserId: row.actorUserId ?? null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      route: row.route,
      metadata: row.metadata ?? null,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedId(row.id);
      window.setTimeout(() => setCopiedId((current) => (current === row.id ? null : current)), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore.
    }
  };

  const reload = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: '300' });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (action) params.set('action', action);
    if (entityType) params.set('entityType', entityType);
    if (actorUserId) params.set('actorUserId', actorUserId);
    fetch(`/api/admin/audit-log?${params.toString()}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to load audit log.');
        return data;
      })
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load audit log.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: '300' });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (action) params.set('action', action);
    if (entityType) params.set('entityType', entityType);
    if (actorUserId) params.set('actorUserId', actorUserId);
    fetch(`/api/admin/audit-log?${params.toString()}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to load audit log.');
        return data;
      })
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load audit log.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [action, actorUserId, entityType, from, to]);

  const actionOptions = Array.from(new Set(rows.map((row) => row.action))).sort();
  const entityOptions = Array.from(new Set(rows.map((row) => row.entityType))).sort();
  const actorOptions = Array.from(
    new Map(
      rows
        .filter((row) => row.actorUserId)
        .map((row) => [row.actorUserId as string, row.actorNameOrEmail]),
    ).entries(),
  ).map(([value, label]) => ({ value, label }));

  const listStatus = useMemo(() => {
    if (loading) return 'loading' as const;
    if (error) return 'error' as const;
    if (rows.length === 0) return 'empty' as const;
    return 'success' as const;
  }, [error, loading, rows.length]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={History}
        title="Audit log"
        description="A plain-English record of who did what, and when, across the system."
      />

      <DashboardTableCard>
        <DashboardTableToolbar label="Filters">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={dashboardTableSelectClass}
              aria-label="Filter from date"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={dashboardTableSelectClass}
              aria-label="Filter to date"
            />
            <StrideSelect
              value={action}
              onChange={(value) => setAction(value)}
              options={[
                { value: '', label: 'All activity' },
                ...actionOptions.map((value) => ({ value, label: describeAuditAction(value) })),
              ]}
              ariaLabel="Filter by action"
              className="w-full"
            />
            <StrideSelect
              value={entityType}
              onChange={(value) => setEntityType(value)}
              options={[
                { value: '', label: 'All items' },
                ...entityOptions.map((value) => ({ value, label: describeEntityType(value) })),
              ]}
              ariaLabel="Filter by resource"
              className="w-full"
            />
            <StrideSelect
              value={actorUserId}
              onChange={(value) => setActorUserId(value)}
              options={[
                { value: '', label: 'All users' },
                ...actorOptions.map((item) => ({ value: item.value, label: item.label })),
              ]}
              ariaLabel="Filter by user"
              className="w-full"
            />
          </div>
        </DashboardTableToolbar>

        <DashboardAsyncState
          status={listStatus}
          error={error}
          onRetry={reload}
          empty={
            <DashboardTableEmpty
              icon={<History className="h-8 w-8 text-neutral-300" aria-hidden />}
              title="No audit events"
              description="No audit events found for the current filters."
            />
          }
        >
          <DashboardTableViewport minWidth={1000}>
            <DashboardTable>
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">When</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Who</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Activity</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Item</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">Details</th>
                  <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase">
                    <span className="sr-only">Technical details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const when = formatWhen(row.createdAt);
                  const tone = auditActionTone(row.action);
                  const entityLabel = describeEntityType(row.entityType);
                  const entityRef = describeEntityReference(row.entityType, row.entityId, row.metadata);
                  const details = describeMetadata(row.metadata);
                  const isOpen = expanded.has(row.id);
                  const isCopied = copiedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr className={`align-top ${isOpen ? '' : 'border-b border-neutral-100'}`}>
                        <td className="px-4 py-3 text-sm text-neutral-700 whitespace-nowrap">
                          <div className="font-medium text-neutral-800">{when.primary}</div>
                          <div className="text-xs text-neutral-500 tabular-nums">{when.secondary}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700">{row.actorNameOrEmail}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_BADGE_CLASS[tone]}`}
                          >
                            {describeAuditAction(row.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700">
                          <div className="font-medium text-neutral-800">{entityLabel}</div>
                          {entityRef ? <div className="text-xs text-neutral-500">{entityRef}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-600 max-w-[26rem]">
                          {details.length ? (
                            <dl className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[auto_1fr]">
                              {details.map((detail) => (
                                <div key={detail.label} className="contents">
                                  <dt className="text-xs text-neutral-500">{detail.label}</dt>
                                  <dd className="text-xs font-medium text-neutral-700 break-words">{detail.value}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(row.id)}
                            aria-expanded={isOpen}
                            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Technical
                          </button>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b border-neutral-100 bg-neutral-50/60">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                                Technical details
                              </p>
                              <button
                                type="button"
                                onClick={() => copyTechnical(row)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5" aria-hidden />
                                    Copy technical details
                                  </>
                                )}
                              </button>
                            </div>
                            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                              <TechRow label="Event ID" value={row.id} />
                              <TechRow label="Action code" value={row.action} mono />
                              <TechRow label="Route" value={row.route || '—'} mono />
                              <TechRow label="Entity type" value={row.entityType} mono />
                              <TechRow label="Entity ID" value={row.entityId || '—'} mono />
                              <TechRow label="Actor user ID" value={row.actorUserId || '—'} mono />
                            </dl>
                            <div className="mt-3">
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                                Raw metadata
                              </p>
                              <pre className="max-h-64 overflow-auto rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-700">
                                {row.metadata ? JSON.stringify(row.metadata, null, 2) : 'No metadata recorded.'}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        </DashboardAsyncState>
      </DashboardTableCard>
    </DashboardPage>
  );
}
