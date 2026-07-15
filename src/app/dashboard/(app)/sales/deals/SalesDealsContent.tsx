'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  Handshake,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';
import { SALES_DEAL_STAGES, type SalesDealStage } from '@/lib/sales/schema';

type DealRow = {
  id: string;
  name: string;
  stage: SalesDealStage;
  value: number;
  currency: string;
  probability: number;
  forecastCategory: string;
  owner: { id: string; name: string } | null;
  expectedCloseDate: string | null;
  accountsInvoiceId: string | null;
  accountsClient: { id: string; name: string } | null;
  primaryContact: { id: string; name: string; email: string | null } | null;
  nextStep: string | null;
  nextStepDue: string | null;
  source: string | null;
  notes: string | null;
  cargoWeightKg?: number | null;
};

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedAmount: number;
};

type DealDetail = DealRow & {
  lineItems?: LineItem[];
  closeWarnings?: { legal: string[]; fleet: string[] };
  activities?: Array<{
    id: string;
    type: string;
    subject: string;
    body: string | null;
    createdAt: string;
  }>;
  stageHistory?: Array<{
    id: string;
    fromStage: string | null;
    toStage: string;
    changedAt: string;
  }>;
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

function formatKes(n: number, currency = 'KES') {
  return `${n.toLocaleString('en-KE')} ${currency}`;
}

export default function SalesDealsContent() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'board' | 'table'>('board');
  const [acting, setActing] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [invoiceMsg, setInvoiceMsg] = useState<string | null>(null);
  const [opsMsg, setOpsMsg] = useState<string | null>(null);
  const [lineDesc, setLineDesc] = useState('');
  const [lineQty, setLineQty] = useState('1');
  const [linePrice, setLinePrice] = useState('');
  const [lineSaving, setLineSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/sales/deals')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        return data.deals as DealRow[];
      })
      .then(setDeals)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed');
        setDeals([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const refreshDetail = useCallback((id: string) => {
    setDetailLoading(true);
    return fetch(`/api/sales/deals/${id}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed');
        return data.deal as DealDetail;
      })
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setInvoiceMsg(null);
    setOpsMsg(null);
    setLineDesc('');
    setLineQty('1');
    setLinePrice('');
    void refreshDetail(selectedId);
  }, [selectedId, refreshDetail]);

  function surfaceCloseOpsNotes(data: {
    closeOps?: { notes?: string[] } | null;
  }) {
    const notes = data.closeOps?.notes;
    if (Array.isArray(notes) && notes.length > 0) {
      setOpsMsg(notes.join(' · '));
    }
  }

  async function moveDeal(id: string, stage: string) {
    setActing(id);
    setError(null);
    setOpsMsg(null);
    try {
      const patch = (acknowledgeWarnings: boolean) =>
        fetch(`/api/sales/deals/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage,
            acknowledgeWarnings,
            ...(stage === 'won'
              ? { createFleetOrder: true, createPurchaseRequest: false }
              : {}),
          }),
        }).then(async (r) => {
          const data = await r.json().catch(() => ({}));
          return { r, data };
        });

      let { r, data } = await patch(false);
      if (r.status === 409 && data.requireAcknowledge) {
        const warnings = Array.isArray(data.warnings) ? (data.warnings as string[]) : [];
        const ok = window.confirm(
          `Close warnings:\n\n${warnings.join('\n') || 'Warnings require acknowledgement.'}\n\nMark as won anyway?`,
        );
        if (!ok) throw new Error(data.error || 'Acknowledgements required');
        ({ r, data } = await patch(true));
      }
      if (!r.ok) throw new Error(data.error || 'Update failed');
      if (stage === 'won') surfaceCloseOpsNotes(data);
      await load();
      if (selectedId === id) await refreshDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setActing(null);
    }
  }

  async function createInvoice(id: string) {
    setActing(id);
    setInvoiceMsg(null);
    setOpsMsg(null);
    try {
      const post = (acknowledgeWarnings: boolean) =>
        fetch(`/api/sales/deals/${id}/create-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acknowledgeWarnings }),
        }).then(async (r) => {
          const data = await r.json().catch(() => ({}));
          return { r, data };
        });

      let { r, data } = await post(false);
      if (r.status === 409 && data.requireAcknowledge) {
        const warnings = Array.isArray(data.warnings) ? (data.warnings as string[]) : [];
        const ok = window.confirm(
          `Invoice warnings:\n\n${warnings.join('\n') || 'Warnings require acknowledgement.'}\n\nCreate invoice anyway?`,
        );
        if (!ok) throw new Error(data.error || 'Acknowledgements required');
        ({ r, data } = await post(true));
      }
      if (!r.ok) throw new Error(data.error || 'Invoice failed');
      setInvoiceMsg(`Invoice #${data.result?.invoiceNumber ?? ''} created in Finance.`);
      surfaceCloseOpsNotes(data);
      load();
      await refreshDetail(id);
    } catch (e) {
      setInvoiceMsg(e instanceof Error ? e.message : 'Invoice failed');
    } finally {
      setActing(null);
    }
  }

  async function addLineItem(dealId: string) {
    setLineSaving(true);
    setInvoiceMsg(null);
    try {
      const r = await fetch(`/api/sales/deals/${dealId}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: lineDesc,
          quantity: Number(lineQty) || 1,
          unitPrice: Number(linePrice),
          syncDealValue: true,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to add line item');
      setLineDesc('');
      setLineQty('1');
      setLinePrice('');
      await load();
      await refreshDetail(dealId);
    } catch (e) {
      setInvoiceMsg(e instanceof Error ? e.message : 'Failed to add line item');
    } finally {
      setLineSaving(false);
    }
  }

  const byStage = useMemo(() => {
    const map: Record<string, DealRow[]> = {};
    for (const s of SALES_DEAL_STAGES) map[s] = [];
    for (const d of deals) {
      (map[d.stage] ??= []).push(d);
    }
    return map;
  }, [deals]);

  const warningList = useMemo(() => {
    if (!detail?.closeWarnings) return [];
    return [...(detail.closeWarnings.legal ?? []), ...(detail.closeWarnings.fleet ?? [])];
  }, [detail]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Sales pipeline"
        description="Move deals across stages. Won deals can draft a Finance invoice."
        icon={Handshake}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[var(--dash-border)] p-0.5">
              <button
                type="button"
                onClick={() => setView('board')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  view === 'board'
                    ? 'bg-[var(--stride-coral)] text-white'
                    : 'text-[var(--dash-text-muted)]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Board
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  view === 'table'
                    ? 'bg-[var(--stride-coral)] text-white'
                    : 'text-[var(--dash-text-muted)]'
                }`}
              >
                <List className="h-3.5 w-3.5" /> Table
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" /> Add deal
            </button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {opsMsg ? (
        <div className="mb-4 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-3 py-2 text-sm text-[var(--dash-text-strong)]">
          {opsMsg}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--dash-text-muted)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading pipeline…
        </div>
      ) : deals.length === 0 ? (
        <div className={`${DASHBOARD_SURFACE_CLASS} px-6 py-16 text-center`}>
          <Handshake className="mx-auto h-10 w-10 text-[var(--stride-coral)]" />
          <h2 className="mt-4 text-lg font-semibold text-[var(--dash-text-strong)]">
            Add your first deal
          </h2>
          <p className="mt-2 text-sm text-[var(--dash-text-muted)]">
            Start the pipeline with a prospect account from Finance clients.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Create deal
          </button>
        </div>
      ) : view === 'board' ? (
        <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {SALES_DEAL_STAGES.map((stage) => {
            const col = byStage[stage] ?? [];
            const colValue = col.reduce((s, d) => s + d.value, 0);
            return (
              <section
                key={stage}
                className="flex min-h-[18rem] flex-col rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)]"
              >
                <header className="border-b border-[var(--dash-border)] px-3 py-2">
                  <p className="text-sm font-semibold text-[var(--dash-text-strong)]">
                    {STAGE_LABELS[stage]}
                    <span className="ml-2 text-xs font-normal text-[var(--dash-text-muted)]">
                      ({col.length})
                    </span>
                  </p>
                  <p className="text-[10px] text-[var(--dash-text-muted)]">{formatKes(colValue)}</p>
                </header>
                <ul className="flex flex-1 flex-col gap-2 p-2">
                  {col.length === 0 ? (
                    <li className="py-6 text-center text-xs text-[var(--dash-text-muted)]">Empty</li>
                  ) : (
                    col.map((deal) => (
                      <li
                        key={deal.id}
                        className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3 shadow-sm"
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => setSelectedId(deal.id)}
                        >
                          <p className="text-sm font-medium text-[var(--dash-text-strong)]">
                            {deal.name}
                          </p>
                          <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
                            {deal.accountsClient?.name ?? 'No account'}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[var(--stride-coral)]">
                            {formatKes(deal.value, deal.currency)} · {deal.probability}%
                          </p>
                          <p className="mt-1 text-[10px] text-[var(--dash-text-muted)]">
                            {deal.owner?.name ?? '—'}
                            {deal.expectedCloseDate ? ` · ${deal.expectedCloseDate}` : ''}
                          </p>
                        </button>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {SALES_DEAL_STAGES.filter((s) => s !== deal.stage)
                            .slice(0, 4)
                            .map((s) => (
                              <button
                                key={s}
                                type="button"
                                disabled={acting === deal.id}
                                onClick={() => void moveDeal(deal.id, s)}
                                className="rounded border border-[var(--dash-border)] px-1.5 py-0.5 text-[10px] text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]"
                              >
                                → {STAGE_LABELS[s]}
                              </button>
                            ))}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS}`}>
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
              <tr>
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Close</th>
                <th className="px-4 py-3">Finance</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr
                  key={d.id}
                  className="cursor-pointer border-t border-[var(--dash-border)] hover:bg-[var(--dash-hover)]"
                  onClick={() => setSelectedId(d.id)}
                >
                  <td className="px-4 py-3 font-medium text-[var(--dash-text-strong)]">{d.name}</td>
                  <td className="px-4 py-3">{d.accountsClient?.name ?? '—'}</td>
                  <td className="px-4 py-3">{d.owner?.name ?? '—'}</td>
                  <td className="px-4 py-3">{STAGE_LABELS[d.stage]}</td>
                  <td className="px-4 py-3">{formatKes(d.value, d.currency)}</td>
                  <td className="px-4 py-3">{d.expectedCloseDate ?? '—'}</td>
                  <td className="px-4 py-3">
                    {d.accountsInvoiceId ? (
                      <Link
                        href={`/dashboard/accounts/invoices`}
                        className="text-[var(--stride-coral)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Invoiced
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog">
          <button
            type="button"
            className="flex-1"
            aria-label="Close drawer"
            onClick={() => setSelectedId(null)}
          />
          <aside className="flex h-full w-full max-w-md flex-col border-l border-[var(--dash-border)] bg-[var(--dash-surface-solid)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--dash-border)] px-4 py-3">
              <h2 className="font-semibold text-[var(--dash-text-strong)]">Deal detail</h2>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Close">
                <X className="h-5 w-5 text-[var(--dash-text-muted)]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detailLoading || !detail ? (
                <div className="flex items-center gap-2 text-[var(--dash-text-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <div className="space-y-4 text-sm">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--dash-text-strong)]">
                      {detail.name}
                    </h3>
                    <p className="text-[var(--dash-text-muted)]">
                      {detail.accountsClient?.name ?? 'No account'} ·{' '}
                      {STAGE_LABELS[detail.stage]} · {detail.probability}%
                    </p>
                  </div>
                  <p className="text-2xl font-semibold text-[var(--stride-coral)]">
                    {formatKes(detail.value, detail.currency)}
                  </p>

                  {warningList.length > 0 ? (
                    <div className="rounded-lg border border-amber-300/70 bg-amber-50/40 px-3 py-2 dark:bg-amber-950/20">
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Close warnings
                      </div>
                      <ul className="list-disc space-y-1 pl-4 text-xs text-amber-900 dark:text-amber-100">
                        {warningList.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-[var(--dash-text-muted)]">Owner</dt>
                      <dd>{detail.owner?.name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--dash-text-muted)]">Close</dt>
                      <dd>{detail.expectedCloseDate ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--dash-text-muted)]">Contact</dt>
                      <dd>{detail.primaryContact?.name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--dash-text-muted)]">Source</dt>
                      <dd>{detail.source ?? '—'}</dd>
                    </div>
                    {detail.cargoWeightKg != null ? (
                      <div>
                        <dt className="text-[var(--dash-text-muted)]">Cargo (kg)</dt>
                        <dd>{detail.cargoWeightKg.toLocaleString('en-KE')}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-[var(--dash-text-muted)]">
                      Line items
                    </p>
                    <ul className="mb-3 space-y-2">
                      {(detail.lineItems ?? []).length === 0 ? (
                        <li className="text-xs text-[var(--dash-text-muted)]">No line items yet.</li>
                      ) : (
                        (detail.lineItems ?? []).map((li) => (
                          <li
                            key={li.id}
                            className="flex justify-between gap-2 rounded border border-[var(--dash-border)] px-2 py-1.5 text-xs"
                          >
                            <span>
                              {li.description}
                              <span className="text-[var(--dash-text-muted)]">
                                {' '}
                                · {li.quantity} × {formatKes(li.unitPrice, detail.currency)}
                              </span>
                            </span>
                            <span className="shrink-0 font-medium">
                              {formatKes(li.extendedAmount, detail.currency)}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                    <form
                      className="space-y-2 rounded-lg border border-[var(--dash-border)] p-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void addLineItem(detail.id);
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-wide text-[var(--dash-text-muted)]">
                        Add line item
                      </p>
                      <input
                        required
                        placeholder="Description"
                        value={lineDesc}
                        onChange={(e) => setLineDesc(e.target.value)}
                        className="dash-auth-input w-full text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          required
                          type="number"
                          min={0.01}
                          step="any"
                          placeholder="Qty"
                          value={lineQty}
                          onChange={(e) => setLineQty(e.target.value)}
                          className="dash-auth-input w-full text-xs"
                        />
                        <input
                          required
                          type="number"
                          min={0}
                          step="any"
                          placeholder="Unit price"
                          value={linePrice}
                          onChange={(e) => setLinePrice(e.target.value)}
                          className="dash-auth-input w-full text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={lineSaving}
                        className="w-full rounded-lg border border-[var(--dash-border)] px-2 py-1.5 text-xs font-medium hover:bg-[var(--dash-hover)] disabled:opacity-60"
                      >
                        {lineSaving ? 'Adding…' : 'Add line (sync deal value)'}
                      </button>
                    </form>
                  </div>

                  {detail.nextStep ? (
                    <div className="rounded-lg border border-[var(--dash-border)] p-3">
                      <p className="text-xs uppercase text-[var(--dash-text-muted)]">Next step</p>
                      <p className="mt-1">{detail.nextStep}</p>
                      {detail.nextStepDue ? (
                        <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
                          Due {detail.nextStepDue}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {detail.stage === 'won' && !detail.accountsInvoiceId ? (
                    <button
                      type="button"
                      disabled={acting === detail.id}
                      onClick={() => void createInvoice(detail.id)}
                      className="w-full rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
                    >
                      Create Finance invoice
                    </button>
                  ) : null}
                  {detail.accountsInvoiceId ? (
                    <p className="text-xs text-emerald-600">Linked to a Finance invoice.</p>
                  ) : null}
                  {invoiceMsg ? (
                    <p className="text-xs text-[var(--dash-text-muted)]">{invoiceMsg}</p>
                  ) : null}
                  {opsMsg ? (
                    <p className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] px-3 py-2 text-xs text-[var(--dash-text-strong)]">
                      {opsMsg}
                    </p>
                  ) : null}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-[var(--dash-text-muted)]">
                      Activity
                    </p>
                    <ul className="space-y-2">
                      {(detail.activities ?? []).length === 0 ? (
                        <li className="text-xs text-[var(--dash-text-muted)]">No activities yet.</li>
                      ) : (
                        (detail.activities ?? []).map((a) => (
                          <li
                            key={a.id}
                            className="rounded border border-[var(--dash-border)] px-2 py-1.5 text-xs"
                          >
                            <span className="font-medium">{a.type}</span> — {a.subject}
                            <div className="text-[var(--dash-text-muted)]">
                              {a.createdAt.slice(0, 10)}
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {createOpen ? (
        <CreateDealModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      ) : null}
    </DashboardPage>
  );
}

function CreateDealModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('500000');
  const [cargoWeightKg, setCargoWeightKg] = useState('');
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [ownerEmployeeId, setOwnerEmployeeId] = useState('');
  const [accountsClientId, setAccountsClientId] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sales/reps')
      .then((r) => r.json())
      .then((data) => {
        const rows = (data.employees ?? []).map(
          (e: { id: string; name: string }) => ({
            id: e.id,
            name: e.name,
          }),
        );
        setEmployees(rows);
        if (rows[0]) setOwnerEmployeeId(rows[0].id);
      })
      .catch(() => setEmployees([]));
    fetch('/api/accounts/clients')
      .then((r) => r.json())
      .then((data) => {
        const rows = (data.clients ?? []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }));
        setClients(rows);
        if (rows[0]) setAccountsClientId(rows[0].id);
      })
      .catch(() => setClients([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/sales/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          value: Number(value),
          ownerEmployeeId,
          accountsClientId: accountsClientId || undefined,
          stage: 'lead',
          ...(cargoWeightKg.trim()
            ? { cargoWeightKg: Math.round(Number(cargoWeightKg)) }
            : {}),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Create failed');
      onCreated();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-[var(--dash-text-strong)]">New deal</h2>
        <label className="mt-4 block text-xs text-[var(--dash-text-muted)]">
          Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Value (KES)
          <input
            required
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Cargo weight (kg)
          <input
            type="number"
            min={0}
            value={cargoWeightKg}
            onChange={(e) => setCargoWeightKg(e.target.value)}
            placeholder="Optional"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Owner
          <select
            required
            value={ownerEmployeeId}
            onChange={(e) => setOwnerEmployeeId(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Finance account
          <select
            value={accountsClientId}
            onChange={(e) => setAccountsClientId(e.target.value)}
            className="dash-auth-input mt-1 w-full"
          >
            <option value="">None</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {err ? <p className="mt-3 text-xs text-red-600">{err}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
