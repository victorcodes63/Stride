'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Handshake,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  RottingBadge,
  SalesDrawer,
  SalesEmptyState,
  SalesFilterBar,
  SalesStageBadge,
  type FilterSelect,
} from '@/components/dashboard/sales';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/hooks/useApiResource';
import { dealIdleDays, isDealRotting } from '@/lib/sales/analytics';
import {
  formatCompactCurrency,
  formatRelativeTime,
  formatSalesCurrency,
  formatShortDate,
} from '@/lib/sales/format';
import { apiFetch, salesKeys, useSalesResource } from '@/lib/sales/hooks';
import {
  SALES_DEAL_ACTIVITY_TYPES,
  SALES_DEAL_STAGES,
  stageLabel,
  STAGE_DEFAULT_PROBABILITY,
  type SalesDealStage,
} from '@/lib/sales/schema';

type Owner = { id: string; name: string } | null;

type DealRow = {
  id: string;
  name: string;
  stage: SalesDealStage;
  value: number;
  currency: string;
  probability: number;
  forecastCategory: string;
  ownerEmployeeId: string | null;
  owner: Owner;
  expectedCloseDate: string | null;
  closedAt: string | null;
  accountsInvoiceId: string | null;
  accountsClient: { id: string; name: string } | null;
  primaryContact: { id: string; name: string; email: string | null } | null;
  nextStep: string | null;
  nextStepDue: string | null;
  source: string | null;
  notes: string | null;
  cargoWeightKg?: number | null;
  stageEnteredAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  lineItemsTotal?: number;
};

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedAmount: number;
  isRecurring: boolean;
  termMonths: number | null;
  product?: { id: string; name: string } | null;
};

type Activity = {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  outcome: string | null;
  actor: { id: string; name: string } | null;
  createdAt: string;
};

type StageHistoryEntry = {
  id: string;
  fromStage: string | null;
  toStage: string;
  changedAt: string;
  changedBy: { id: string; name: string } | null;
};

type DealDetail = DealRow & {
  lineItems?: LineItem[];
  lineItemsTotal?: number;
  activities?: Activity[];
  stageHistory?: StageHistoryEntry[];
  closeWarnings?: { legal: string[]; fleet: string[] };
};

type TaskItem = {
  id: string;
  title: string;
  status: 'open' | 'completed' | 'cancelled';
  type: string;
  dueDate: string | null;
  completedAt: string | null;
  assignee: { id: string; name: string } | null;
  deal: { id: string; name: string; stage: string } | null;
};

type Rep = { id: string; name: string; email: string | null };

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'value', label: 'Value (high → low)' },
  { value: 'close', label: 'Close date' },
  { value: 'idle', label: 'Most idle' },
];

function weightedValue(deals: DealRow[]): number {
  return deals.reduce((sum, d) => sum + d.value * (Math.min(100, Math.max(0, d.probability)) / 100), 0);
}

/** Thin PATCH/POST helper that surfaces the 409 acknowledge-warnings flow. */
async function mutate<T>(url: string, method: string, body?: unknown): Promise<T> {
  return apiFetch<T>(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export default function SalesDealsContent() {
  const queryClient = useQueryClient();
  const invalidateAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: salesKeys.all }),
    [queryClient],
  );

  const [view, setView] = useState<'board' | 'table'>('board');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | SalesDealStage>('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sort, setSort] = useState('recent');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const [movingBusy, setMovingBusy] = useState(false);
  const [warnConfirm, setWarnConfirm] = useState<{ ids: string[]; stage: SalesDealStage; warnings: string[] } | null>(
    null,
  );
  const [bulkConfirm, setBulkConfirm] = useState<{ ids: string[]; stage: SalesDealStage } | null>(null);
  const [fleetOffer, setFleetOffer] = useState<{
    dealId: string;
    dealName: string;
    cargoWeightKg: number | null;
    fleetCustomerId: string | null;
    fleetCustomerName: string | null;
    suggestedPickup: string;
    suggestedDelivery: string;
    notes: string;
  } | null>(null);
  const [fleetBusy, setFleetBusy] = useState(false);

  const repsQuery = useSalesResource<{ employees: Rep[] }>(salesKeys.reps(), '/api/sales/reps');
  const reps = repsQuery.data?.employees ?? [];

  const dealParams = {
    sort,
    owner: ownerFilter !== 'all' ? ownerFilter : undefined,
  };
  const dealUrl = `/api/sales/deals?sort=${encodeURIComponent(sort)}${
    ownerFilter !== 'all' ? `&owner=${encodeURIComponent(ownerFilter)}` : ''
  }`;
  const dealsQuery = useSalesResource<{ deals: DealRow[] }>(salesKeys.deals(dealParams), dealUrl);
  const deals = useMemo(() => dealsQuery.data?.deals ?? [], [dealsQuery.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (stageFilter !== 'all' && d.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        (d.accountsClient?.name.toLowerCase().includes(q) ?? false) ||
        (d.primaryContact?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [deals, search, stageFilter]);

  const byStage = useMemo(() => {
    const map: Record<string, DealRow[]> = {};
    for (const s of SALES_DEAL_STAGES) map[s] = [];
    for (const d of filtered) (map[d.stage] ??= []).push(d);
    return map;
  }, [filtered]);

  // Keep selection in sync with what's currently visible.
  useEffect(() => {
    setSelection((prev) => {
      const visible = new Set(filtered.map((d) => d.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  const runMove = useCallback(
    async (ids: string[], stage: SalesDealStage, acknowledge: boolean) => {
      if (ids.length === 0) return;
      setMovingBusy(true);
      try {
        const results = await Promise.allSettled(
          ids.map((id) =>
            mutate<{
              deal?: unknown;
              wonAutomation?: {
                notes?: string[];
                fleetOffer?: {
                  dealId: string;
                  dealName: string;
                  cargoWeightKg: number | null;
                  fleetCustomerId: string | null;
                  fleetCustomerName: string | null;
                  suggestedPickup: string;
                  suggestedDelivery: string;
                  notes: string;
                } | null;
              } | null;
            }>(`/api/sales/deals/${id}`, 'PATCH', {
              stage,
              acknowledgeWarnings: acknowledge,
            }),
          ),
        );

        const warnings = new Set<string>();
        let needsAck = false;
        let otherError: string | null = null;
        let lastFleetOffer: typeof fleetOffer = null;
        const automationNotes: string[] = [];

        for (const r of results) {
          if (r.status === 'fulfilled') {
            const wa = r.value.wonAutomation;
            if (wa?.notes?.length) automationNotes.push(...wa.notes);
            if (wa?.fleetOffer) lastFleetOffer = wa.fleetOffer;
            continue;
          }
          const reason = r.reason;
          if (
            reason instanceof ApiError &&
            reason.status === 409 &&
            reason.body &&
            typeof reason.body === 'object' &&
            'requireAcknowledge' in reason.body
          ) {
            needsAck = true;
            const w = (reason.body as { warnings?: unknown }).warnings;
            if (Array.isArray(w)) for (const item of w) warnings.add(String(item));
          } else if (
            reason instanceof ApiError &&
            reason.status === 409 &&
            reason.body &&
            typeof reason.body === 'object' &&
            (reason.body as { code?: string }).code === 'ACCEPTED_QUOTE_REQUIRED'
          ) {
            otherError =
              reason.message ||
              'An accepted quote is required before marking this deal won.';
          } else {
            otherError = reason instanceof Error ? reason.message : 'Update failed';
          }
        }

        if (needsAck && !acknowledge) {
          setWarnConfirm({ ids, stage, warnings: [...warnings] });
          return;
        }

        if (otherError) {
          toast.error(otherError);
        } else {
          toast.success(
            ids.length === 1
              ? `Deal moved to ${stageLabel(stage)}.`
              : `${ids.length} deals moved to ${stageLabel(stage)}.`,
          );
          if (automationNotes.length) {
            const skip = automationNotes.find((n) => n.toLowerCase().includes('skipped'));
            if (skip) toast.info(skip);
          }
          if (lastFleetOffer) setFleetOffer(lastFleetOffer);
          setSelection(new Set());
        }
        await invalidateAll();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
      } finally {
        setMovingBusy(false);
      }
    },
    [invalidateAll],
  );

  const ownerOptions = useMemo(
    () => [{ value: 'all', label: 'All owners' }, ...reps.map((r) => ({ value: r.id, label: r.name }))],
    [reps],
  );
  const stageFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All stages' }, ...SALES_DEAL_STAGES.map((s) => ({ value: s, label: stageLabel(s) }))],
    [],
  );

  const filterSelects: FilterSelect[] = [
    {
      id: 'stage',
      value: stageFilter,
      ariaLabel: 'Filter by stage',
      options: stageFilterOptions,
      onChange: (v) => setStageFilter(v as 'all' | SalesDealStage),
    },
    {
      id: 'owner',
      value: ownerFilter,
      ariaLabel: 'Filter by owner',
      options: ownerOptions,
      onChange: setOwnerFilter,
    },
    {
      id: 'sort',
      value: sort,
      ariaLabel: 'Sort deals',
      options: SORT_OPTIONS,
      onChange: setSort,
    },
  ];

  const loading = dealsQuery.isLoading;
  const errored = dealsQuery.isError;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Sales pipeline"
        description="Drag deals across stages, log activity, and hand won deals to Finance."
        icon={Handshake}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[var(--dash-border)] p-0.5">
              <button
                type="button"
                onClick={() => setView('board')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  view === 'board' ? 'bg-[var(--stride-coral)] text-white' : 'text-[var(--dash-text-muted)]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Board
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  view === 'table' ? 'bg-[var(--stride-coral)] text-white' : 'text-[var(--dash-text-muted)]'
                }`}
              >
                <List className="h-3.5 w-3.5" /> Table
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add deal
            </button>
          </div>
        }
      />

      <SalesFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search deals, accounts, contacts…"
        selects={filterSelects}
        resultCount={filtered.length}
      />

      {view === 'table' && selection.size > 0 ? (
        <BulkActionBar
          count={selection.size}
          onClear={() => setSelection(new Set())}
          onMove={(stage) => setBulkConfirm({ ids: [...selection], stage })}
          busy={movingBusy}
        />
      ) : null}

      {loading ? (
        <PipelineSkeleton view={view} />
      ) : errored ? (
        <div className="dashboard-surface flex flex-col items-center gap-3 px-6 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-[var(--stride-coral)]" />
          <p className="text-sm text-[var(--dash-text-strong)]">
            {dealsQuery.error?.message ?? 'Failed to load pipeline.'}
          </p>
          <button type="button" onClick={() => dealsQuery.refetch()} className="btn-secondary px-4 py-2 text-sm">
            Retry
          </button>
        </div>
      ) : deals.length === 0 ? (
        <SalesEmptyState
          icon={Handshake}
          title="Add your first deal"
          description="Start the pipeline with a prospect. You can drag deals across stages and log activity as they progress."
          action={
            <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Create deal
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <SalesEmptyState icon={Handshake} title="No deals match your filters" description="Try clearing search or filters." compact />
      ) : view === 'board' ? (
        <PipelineBoard
          byStage={byStage}
          onOpen={setSelectedId}
          onMove={(id, stage) => void runMove([id], stage, false)}
          disabled={movingBusy}
        />
      ) : (
        <DealsTable
          deals={filtered}
          onOpen={setSelectedId}
          selection={selection}
          onToggle={(id) =>
            setSelection((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onToggleAll={(checked) => setSelection(checked ? new Set(filtered.map((d) => d.id)) : new Set())}
        />
      )}

      {selectedId ? (
        <DealDrawer
          dealId={selectedId}
          reps={reps}
          onClose={() => setSelectedId(null)}
          onChanged={invalidateAll}
          onMoveStage={(stage) => void runMove([selectedId], stage, false)}
        />
      ) : null}

      {createOpen ? (
        <CreateDealModal
          reps={reps}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void invalidateAll();
            toast.success('Deal created.');
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!warnConfirm}
        title="Close warnings"
        tone="danger"
        confirmLabel="Move anyway"
        loading={movingBusy}
        description={
          warnConfirm ? (
            <div className="space-y-2">
              <p>Moving to {stageLabel(warnConfirm.stage)} raised warnings:</p>
              <ul className="list-disc space-y-1 pl-4">
                {warnConfirm.warnings.length > 0 ? (
                  warnConfirm.warnings.map((w) => <li key={w}>{w}</li>)
                ) : (
                  <li>Warnings require acknowledgement.</li>
                )}
              </ul>
            </div>
          ) : null
        }
        onConfirm={() => {
          if (!warnConfirm) return;
          const { ids, stage } = warnConfirm;
          setWarnConfirm(null);
          void runMove(ids, stage, true);
        }}
        onCancel={() => setWarnConfirm(null)}
      />

      <ConfirmDialog
        open={!!fleetOffer}
        title="Create fleet order?"
        confirmLabel="Create draft order"
        loading={fleetBusy}
        description={
          fleetOffer ? (
            <div className="space-y-2 text-sm">
              <p>
                Deal <strong>{fleetOffer.dealName}</strong> is won
                {fleetOffer.cargoWeightKg != null
                  ? ` · cargo ${fleetOffer.cargoWeightKg} kg`
                  : ''}
                .
              </p>
              <p>
                Customer:{' '}
                {fleetOffer.fleetCustomerName ??
                  'No FleetCustomer linked to this billing client — open Fleet to create one first.'}
              </p>
              <p className="text-[var(--dash-text-muted)]">
                {fleetOffer.suggestedPickup} → {fleetOffer.suggestedDelivery}
              </p>
            </div>
          ) : null
        }
        onConfirm={() => {
          if (!fleetOffer?.fleetCustomerId) {
            toast.error('Link a fleet customer to this account before creating an order.');
            return;
          }
          void (async () => {
            setFleetBusy(true);
            try {
              await apiFetch('/api/fleet/orders', {
                method: 'POST',
                body: JSON.stringify({
                  customerId: fleetOffer.fleetCustomerId,
                  pickupLocation: fleetOffer.suggestedPickup,
                  deliveryLocation: fleetOffer.suggestedDelivery,
                  cargoType: 'Sales closed-won cargo',
                  cargoWeightKg: fleetOffer.cargoWeightKg,
                  notes: fleetOffer.notes,
                }),
              });
              toast.success('Fleet order draft created.');
              setFleetOffer(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Fleet order failed.');
            } finally {
              setFleetBusy(false);
            }
          })();
        }}
        onCancel={() => setFleetOffer(null)}
      />

      <ConfirmDialog
        open={!!bulkConfirm}
        title="Move deals"
        confirmLabel="Move deals"
        loading={movingBusy}
        description={
          bulkConfirm
            ? `Move ${bulkConfirm.ids.length} deal${bulkConfirm.ids.length === 1 ? '' : 's'} to ${stageLabel(bulkConfirm.stage)}?`
            : null
        }
        onConfirm={() => {
          if (!bulkConfirm) return;
          const { ids, stage } = bulkConfirm;
          setBulkConfirm(null);
          void runMove(ids, stage, false);
        }}
        onCancel={() => setBulkConfirm(null)}
      />
    </DashboardPage>
  );
}

function BulkActionBar({
  count,
  onClear,
  onMove,
  busy,
}: {
  count: number;
  onClear: () => void;
  onMove: (stage: SalesDealStage) => void;
  busy: boolean;
}) {
  const [target, setTarget] = useState<SalesDealStage>('qualified');
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--stride-coral)]/40 bg-[var(--stride-coral)]/5 px-4 py-2.5">
      <span className="text-sm font-medium text-[var(--dash-text-strong)]">{count} selected</span>
      <div className="ml-auto flex items-center gap-2">
        <StrideSelect
          value={target}
          onChange={(v) => setTarget(v as SalesDealStage)}
          options={SALES_DEAL_STAGES.map((s) => ({ value: s, label: stageLabel(s) }))}
          ariaLabel="Target stage"
          size="sm"
          className="min-w-[9rem]"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => onMove(target)}
          className="btn-primary px-3 py-1.5 text-sm disabled:opacity-60"
        >
          Move
        </button>
        <button type="button" onClick={onClear} className="btn-secondary px-3 py-1.5 text-sm">
          Clear
        </button>
      </div>
    </div>
  );
}

function PipelineSkeleton({ view }: { view: 'board' | 'table' }) {
  if (view === 'table') {
    return (
      <div className="dashboard-surface overflow-hidden">
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--dash-surface-muted)]" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {SALES_DEAL_STAGES.map((s) => (
        <div key={s} className="min-h-[18rem] rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-2">
          <div className="mb-2 h-6 animate-pulse rounded bg-[var(--dash-surface-solid)]" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-2 h-20 animate-pulse rounded-lg bg-[var(--dash-surface-solid)]" />
          ))}
        </div>
      ))}
    </div>
  );
}

function PipelineBoard({
  byStage,
  onOpen,
  onMove,
  disabled,
}: {
  byStage: Record<string, DealRow[]>;
  onOpen: (id: string) => void;
  onMove: (id: string, stage: SalesDealStage) => void;
  disabled: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const allDeals = useMemo(() => Object.values(byStage).flat(), [byStage]);
  const activeDeal = activeId ? allDeals.find((d) => d.id === activeId) ?? null : null;

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const deal = allDeals.find((d) => d.id === String(active.id));
    const target = String(over.id) as SalesDealStage;
    if (!deal || !SALES_DEAL_STAGES.includes(target) || deal.stage === target) return;
    onMove(deal.id, target);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {SALES_DEAL_STAGES.map((stage) => (
          <StageColumn key={stage} stage={stage} deals={byStage[stage] ?? []} onOpen={onOpen} disabled={disabled} />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? (
          <div className="w-64 rotate-2 rounded-lg border border-[var(--stride-coral)]/40 bg-[var(--dash-surface-solid)] p-3 shadow-xl">
            <p className="text-sm font-medium text-[var(--dash-text-strong)]">{activeDeal.name}</p>
            <p className="mt-1 text-xs font-semibold text-[var(--stride-coral)]">
              {formatSalesCurrency(activeDeal.value, activeDeal.currency)}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  stage,
  deals,
  onOpen,
  disabled,
}: {
  stage: SalesDealStage;
  deals: DealRow[];
  onOpen: (id: string) => void;
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = deals.reduce((s, d) => s + d.value, 0);
  const weighted = weightedValue(deals);
  return (
    <section className="flex min-h-[18rem] flex-col rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)]">
      <header className="border-b border-[var(--dash-border)] px-3 py-2">
        <div className="flex items-center justify-between">
          <SalesStageBadge stage={stage} />
          <span className="text-xs font-medium text-[var(--dash-text-muted)]">{deals.length}</span>
        </div>
        <p className="mt-1.5 text-xs font-semibold text-[var(--dash-text-strong)]">{formatCompactCurrency(total)}</p>
        <p className="text-[10px] text-[var(--dash-text-muted)]">weighted {formatCompactCurrency(weighted)}</p>
      </header>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 p-2 transition-colors ${
          isOver ? 'bg-[var(--stride-coral)]/5 ring-2 ring-inset ring-[var(--stride-coral)]/30' : ''
        }`}
      >
        {deals.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-[var(--dash-text-muted)]">Drop here</p>
        ) : (
          deals.map((deal) => <DealCard key={deal.id} deal={deal} onOpen={() => onOpen(deal.id)} disabled={disabled} />)
        )}
      </div>
    </section>
  );
}

function DealCard({ deal, onOpen, disabled }: { deal: DealRow; onOpen: () => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id, disabled });
  const idle = dealIdleDays(deal);
  const rotting = isDealRotting(deal);
  return (
    <div
      ref={setNodeRef}
      className={`group rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-2.5 shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-[var(--dash-text-muted)]/50 hover:text-[var(--dash-text-muted)] active:cursor-grabbing"
          aria-label="Drag to change stage"
          {...listeners}
          {...attributes}
        >
          <GripDots />
        </button>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-[var(--dash-text-strong)]">{deal.name}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--dash-text-muted)]">
            {deal.accountsClient?.name ?? 'No account'}
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--stride-coral)]">
            {formatSalesCurrency(deal.value, deal.currency)}
            <span className="ml-1 font-normal text-[var(--dash-text-muted)]">· {deal.probability}%</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {idle != null ? <RottingBadge idleDays={idle} rotting={rotting} /> : null}
          </div>
          <p className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--dash-text-muted)]">
            <span className="truncate">{deal.owner?.name ?? 'Unassigned'}</span>
            {deal.expectedCloseDate ? <span className="shrink-0">{formatShortDate(deal.expectedCloseDate)}</span> : null}
          </p>
        </button>
      </div>
    </div>
  );
}

function GripDots() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="6" cy="4" r="1.4" />
      <circle cx="10" cy="4" r="1.4" />
      <circle cx="6" cy="8" r="1.4" />
      <circle cx="10" cy="8" r="1.4" />
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="10" cy="12" r="1.4" />
    </svg>
  );
}

function DealsTable({
  deals,
  onOpen,
  selection,
  onToggle,
  onToggleAll,
}: {
  deals: DealRow[];
  onOpen: (id: string) => void;
  selection: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const allChecked = deals.length > 0 && deals.every((d) => selection.has(d.id));
  return (
    <div className="dashboard-surface overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--dash-surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--dash-text-muted)]">
          <tr>
            <th className="px-3 py-3">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
                className="h-4 w-4 accent-[var(--stride-coral)]"
              />
            </th>
            <th className="px-4 py-3">Deal</th>
            <th className="px-4 py-3">Account</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Stage</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Prob.</th>
            <th className="px-4 py-3">Idle</th>
            <th className="px-4 py-3">Close</th>
            <th className="px-4 py-3">Finance</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => {
            const idle = dealIdleDays(d);
            const rotting = isDealRotting(d);
            return (
              <tr
                key={d.id}
                className={`border-t border-[var(--dash-border)] transition-colors hover:bg-[var(--dash-hover)] ${
                  selection.has(d.id) ? 'bg-[var(--stride-coral)]/5' : ''
                }`}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${d.name}`}
                    checked={selection.has(d.id)}
                    onChange={() => onToggle(d.id)}
                    className="h-4 w-4 accent-[var(--stride-coral)]"
                  />
                </td>
                <td className="cursor-pointer px-4 py-3 font-medium text-[var(--dash-text-strong)]" onClick={() => onOpen(d.id)}>
                  {d.name}
                </td>
                <td className="cursor-pointer px-4 py-3" onClick={() => onOpen(d.id)}>
                  {d.accountsClient?.name ?? '—'}
                </td>
                <td className="px-4 py-3">{d.owner?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <SalesStageBadge stage={d.stage} />
                </td>
                <td className="px-4 py-3 font-medium">{formatSalesCurrency(d.value, d.currency)}</td>
                <td className="px-4 py-3">{d.probability}%</td>
                <td className="px-4 py-3">{idle != null ? <RottingBadge idleDays={idle} rotting={rotting} /> : '—'}</td>
                <td className="px-4 py-3">{d.expectedCloseDate ? formatShortDate(d.expectedCloseDate) : '—'}</td>
                <td className="px-4 py-3">
                  {d.accountsInvoiceId ? (
                    <Link
                      href="/dashboard/accounts/invoices"
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deal drawer                                                         */
/* ------------------------------------------------------------------ */

function DealDrawer({
  dealId,
  reps,
  onClose,
  onChanged,
  onMoveStage,
}: {
  dealId: string;
  reps: Rep[];
  onClose: () => void;
  onChanged: () => Promise<unknown> | void;
  onMoveStage: (stage: SalesDealStage) => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useSalesResource<{ deal: DealDetail }>(salesKeys.deal(dealId), `/api/sales/deals/${dealId}`);
  const detail = detailQuery.data?.deal ?? null;

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: salesKeys.deal(dealId) });
    await onChanged();
  }, [queryClient, dealId, onChanged]);

  const [editing, setEditing] = useState(false);
  const [invoiceConfirm, setInvoiceConfirm] = useState<{ warnings: string[] } | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  const warnings = useMemo(() => {
    if (!detail?.closeWarnings) return [];
    return [...(detail.closeWarnings.legal ?? []), ...(detail.closeWarnings.fleet ?? [])];
  }, [detail]);

  async function createInvoice(acknowledge: boolean) {
    if (!detail) return;
    setInvoiceBusy(true);
    try {
      const data = await mutate<{ result?: { invoiceNumber?: number } }>(
        `/api/sales/deals/${detail.id}/create-invoice`,
        'POST',
        { acknowledgeWarnings: acknowledge },
      );
      toast.success(`Invoice #${data.result?.invoiceNumber ?? ''} created in Finance.`);
      setInvoiceConfirm(null);
      await refresh();
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        e.body &&
        typeof e.body === 'object' &&
        'requireAcknowledge' in e.body
      ) {
        const w = (e.body as { warnings?: unknown }).warnings;
        setInvoiceConfirm({ warnings: Array.isArray(w) ? w.map(String) : [] });
      } else {
        toast.error(e instanceof Error ? e.message : 'Invoice failed');
      }
    } finally {
      setInvoiceBusy(false);
    }
  }

  const idle = detail ? dealIdleDays(detail) : null;

  return (
    <>
      <SalesDrawer
        open
        onClose={onClose}
        width="xl"
        title={detail?.name ?? 'Deal'}
        subtitle={
          detail ? (
            <span className="flex flex-wrap items-center gap-2">
              <SalesStageBadge stage={detail.stage} />
              <span>{detail.accountsClient?.name ?? 'No account'}</span>
              {idle != null ? <RottingBadge idleDays={idle} rotting={isDealRotting(detail)} /> : null}
            </span>
          ) : null
        }
        footer={
          detail ? (
            <div className="flex flex-wrap items-center gap-2">
              <StrideSelect
                value={detail.stage}
                onChange={(v) => onMoveStage(v as SalesDealStage)}
                options={SALES_DEAL_STAGES.map((s) => ({ value: s, label: stageLabel(s) }))}
                ariaLabel="Move stage"
                size="sm"
                className="min-w-[10rem]"
              />
              {detail.stage === 'won' && !detail.accountsInvoiceId ? (
                <button
                  type="button"
                  onClick={() => void createInvoice(false)}
                  disabled={invoiceBusy}
                  className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-60"
                >
                  <Receipt className="h-4 w-4" /> Create invoice
                </button>
              ) : null}
              {detail.accountsInvoiceId ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Invoiced
                </span>
              ) : null}
            </div>
          ) : null
        }
      >
        {detailQuery.isLoading || !detail ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-[var(--dash-surface-muted)]" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {warnings.length > 0 ? (
              <div className="rounded-lg border border-amber-300/70 bg-amber-50/40 px-3 py-2 dark:bg-amber-950/20">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" /> Close warnings
                </div>
                <ul className="list-disc space-y-1 pl-4 text-xs text-amber-900 dark:text-amber-100">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <DealInfoSection
              detail={detail}
              reps={reps}
              editing={editing}
              onEditToggle={() => setEditing((v) => !v)}
              onSaved={async () => {
                setEditing(false);
                await refresh();
              }}
            />

            <LineItemsSection detail={detail} onChanged={refresh} />
            <ActivitySection detail={detail} onChanged={refresh} />
            <TasksSection dealId={detail.id} reps={reps} defaultAssignee={detail.ownerEmployeeId} onChanged={refresh} />
            <StageHistorySection history={detail.stageHistory ?? []} />
          </div>
        )}
      </SalesDrawer>

      <ConfirmDialog
        open={!!invoiceConfirm}
        title="Invoice warnings"
        tone="danger"
        confirmLabel="Create anyway"
        loading={invoiceBusy}
        description={
          invoiceConfirm ? (
            <ul className="list-disc space-y-1 pl-4">
              {invoiceConfirm.warnings.length > 0 ? (
                invoiceConfirm.warnings.map((w) => <li key={w}>{w}</li>)
              ) : (
                <li>Warnings require acknowledgement.</li>
              )}
            </ul>
          ) : null
        }
        onConfirm={() => void createInvoice(true)}
        onCancel={() => setInvoiceConfirm(null)}
      />
    </>
  );
}

function DealInfoSection({
  detail,
  reps,
  editing,
  onEditToggle,
  onSaved,
}: {
  detail: DealDetail;
  reps: Rep[];
  editing: boolean;
  onEditToggle: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [name, setName] = useState(detail.name);
  const [value, setValue] = useState(String(detail.value));
  const [probability, setProbability] = useState(String(detail.probability));
  const [closeDate, setCloseDate] = useState(detail.expectedCloseDate ?? '');
  const [nextStep, setNextStep] = useState(detail.nextStep ?? '');
  const [owner, setOwner] = useState(detail.ownerEmployeeId ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(detail.name);
    setValue(String(detail.value));
    setProbability(String(detail.probability));
    setCloseDate(detail.expectedCloseDate ?? '');
    setNextStep(detail.nextStep ?? '');
    setOwner(detail.ownerEmployeeId ?? '');
  }, [detail]);

  async function save() {
    setSaving(true);
    try {
      await mutate(`/api/sales/deals/${detail.id}`, 'PATCH', {
        name: name.trim() || detail.name,
        value: Number(value),
        probability: Number(probability),
        expectedCloseDate: closeDate || null,
        nextStep: nextStep.trim(),
        ownerEmployeeId: owner || undefined,
      });
      toast.success('Deal updated.');
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">Details</h3>
          <button
            type="button"
            onClick={onEditToggle}
            className="inline-flex items-center gap-1 text-xs text-[var(--stride-coral)] hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        </div>
        <p className="text-2xl font-semibold text-[var(--stride-coral)]">
          {formatSalesCurrency(detail.value, detail.currency)}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <Info label="Owner" value={detail.owner?.name ?? '—'} />
          <Info label="Probability" value={`${detail.probability}%`} />
          <Info label="Expected close" value={detail.expectedCloseDate ? formatShortDate(detail.expectedCloseDate) : '—'} />
          <Info label="Contact" value={detail.primaryContact?.name ?? '—'} />
          <Info label="Source" value={detail.source ?? '—'} />
          <Info label="Forecast" value={detail.forecastCategory} />
        </dl>
        {detail.nextStep ? (
          <div className="mt-3 rounded-lg border border-[var(--dash-border)] p-3 text-sm">
            <p className="text-xs uppercase text-[var(--dash-text-muted)]">Next step</p>
            <p className="mt-1 text-[var(--dash-text-strong)]">{detail.nextStep}</p>
            {detail.nextStepDue ? (
              <p className="mt-1 text-xs text-[var(--dash-text-muted)]">Due {formatShortDate(detail.nextStepDue)}</p>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--dash-border)] p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">Edit deal</h3>
        <button type="button" onClick={onEditToggle} className="rounded p-1 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="dash-auth-input w-full text-sm" />
        </Field>
        <Field label="Value">
          <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="dash-auth-input w-full text-sm" />
        </Field>
        <Field label="Probability %">
          <input type="number" min={0} max={100} value={probability} onChange={(e) => setProbability(e.target.value)} className="dash-auth-input w-full text-sm" />
        </Field>
        <Field label="Expected close">
          <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className="dash-auth-input w-full text-sm" />
        </Field>
        <Field label="Owner">
          <StrideSelect
            value={owner}
            onChange={setOwner}
            options={reps.map((r) => ({ value: r.id, label: r.name }))}
            ariaLabel="Owner"
            size="sm"
          />
        </Field>
        <Field label="Next step" className="col-span-2">
          <input value={nextStep} onChange={(e) => setNextStep(e.target.value)} className="dash-auth-input w-full text-sm" placeholder="e.g. Send proposal" />
        </Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onEditToggle} className="btn-secondary px-3 py-1.5 text-sm">
          Cancel
        </button>
        <button type="button" onClick={() => void save()} disabled={saving} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--dash-text-muted)]">{label}</dt>
      <dd className="text-[var(--dash-text-strong)]">{value}</dd>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-xs text-[var(--dash-text-muted)] ${className ?? ''}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function LineItemsSection({ detail, onChanged }: { detail: DealDetail; onChanged: () => Promise<void> | void }) {
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [syncValue, setSyncValue] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const items = detail.lineItems ?? [];
  const total = detail.lineItemsTotal ?? items.reduce((s, i) => s + i.extendedAmount, 0);

  async function add() {
    if (!desc.trim() || !Number.isFinite(Number(price))) return;
    setSaving(true);
    try {
      await mutate(`/api/sales/deals/${detail.id}/line-items`, 'POST', {
        description: desc.trim(),
        quantity: Number(qty) || 1,
        unitPrice: Number(price),
        syncDealValue: syncValue,
      });
      setDesc('');
      setQty('1');
      setPrice('');
      toast.success('Line item added.');
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add line item');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setRemovingId(id);
    try {
      await mutate(`/api/sales/deals/${detail.id}/line-items?lineItemId=${encodeURIComponent(id)}`, 'DELETE');
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">Line items</h3>
        <span className="text-sm font-semibold text-[var(--dash-text-strong)]">{formatSalesCurrency(total, detail.currency)}</span>
      </div>
      <ul className="mb-3 space-y-1.5">
        {items.length === 0 ? (
          <li className="text-xs text-[var(--dash-text-muted)]">No line items yet.</li>
        ) : (
          items.map((li) => (
            <li key={li.id} className="flex items-center justify-between gap-2 rounded border border-[var(--dash-border)] px-2 py-1.5 text-xs">
              <span className="min-w-0">
                <span className="font-medium text-[var(--dash-text-strong)]">{li.description}</span>
                {li.product ? <span className="ml-1 text-[var(--dash-text-muted)]">({li.product.name})</span> : null}
                <span className="text-[var(--dash-text-muted)]"> · {li.quantity} × {formatSalesCurrency(li.unitPrice, detail.currency)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-medium">{formatSalesCurrency(li.extendedAmount, detail.currency)}</span>
                <button
                  type="button"
                  onClick={() => void remove(li.id)}
                  disabled={removingId === li.id}
                  aria-label="Remove line item"
                  className="rounded p-1 text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          ))
        )}
      </ul>
      <form
        className="space-y-2 rounded-lg border border-[var(--dash-border)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input required placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} className="dash-auth-input w-full text-xs" />
        <div className="grid grid-cols-2 gap-2">
          <input required type="number" min={0.01} step="any" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="dash-auth-input w-full text-xs" />
          <input required type="number" min={0} step="any" placeholder="Unit price" value={price} onChange={(e) => setPrice(e.target.value)} className="dash-auth-input w-full text-xs" />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
            <input type="checkbox" checked={syncValue} onChange={(e) => setSyncValue(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--stride-coral)]" />
            Sync deal value
          </label>
          <button type="submit" disabled={saving} className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs disabled:opacity-60">
            <Plus className="h-3.5 w-3.5" /> {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </section>
  );
}

function ActivitySection({ detail, onChanged }: { detail: DealDetail; onChanged: () => Promise<void> | void }) {
  const [type, setType] = useState<string>('call');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const activities = detail.activities ?? [];

  async function log() {
    if (!subject.trim()) return;
    setSaving(true);
    try {
      await mutate(`/api/sales/deals/${detail.id}/activities`, 'POST', {
        type,
        subject: subject.trim(),
        body: body.trim() || undefined,
      });
      setSubject('');
      setBody('');
      toast.success('Activity logged.');
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to log activity');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">Activity</h3>
      <form
        className="mb-3 space-y-2 rounded-lg border border-[var(--dash-border)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void log();
        }}
      >
        <div className="flex gap-2">
          <StrideSelect
            value={type}
            onChange={setType}
            options={SALES_DEAL_ACTIVITY_TYPES.filter((t) => t !== 'task').map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))}
            ariaLabel="Activity type"
            size="sm"
            className="w-32 shrink-0"
          />
          <input required placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="dash-auth-input w-full text-xs" />
        </div>
        <textarea placeholder="Notes (optional)" value={body} onChange={(e) => setBody(e.target.value)} rows={2} className="dash-auth-input w-full text-xs" />
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-secondary px-2.5 py-1.5 text-xs disabled:opacity-60">
            {saving ? 'Logging…' : 'Log activity'}
          </button>
        </div>
      </form>
      <ul className="space-y-2">
        {activities.length === 0 ? (
          <li className="text-xs text-[var(--dash-text-muted)]">No activities yet.</li>
        ) : (
          activities.map((a) => (
            <li key={a.id} className="rounded border border-[var(--dash-border)] px-2.5 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium capitalize text-[var(--dash-text-strong)]">{a.type} · {a.subject}</span>
                <span className="shrink-0 text-[var(--dash-text-muted)]">{formatRelativeTime(a.createdAt)}</span>
              </div>
              {a.body ? <p className="mt-1 text-[var(--dash-text-muted)]">{a.body}</p> : null}
              {a.actor ? <p className="mt-1 text-[10px] text-[var(--dash-text-muted)]">by {a.actor.name}</p> : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function TasksSection({
  dealId,
  reps,
  defaultAssignee,
  onChanged,
}: {
  dealId: string;
  reps: Rep[];
  defaultAssignee: string | null;
  onChanged: () => Promise<void> | void;
}) {
  const queryClient = useQueryClient();
  const tasksQuery = useSalesResource<{ tasks: TaskItem[] }>(
    salesKeys.tasks({ dealId }),
    `/api/sales/tasks?dealId=${encodeURIComponent(dealId)}`,
  );
  const tasks = tasksQuery.data?.tasks ?? [];

  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [assignee, setAssignee] = useState(defaultAssignee ?? '');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: salesKeys.tasks({ dealId }) });
    await onChanged();
  }, [queryClient, dealId, onChanged]);

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await mutate('/api/sales/tasks', 'POST', {
        title: title.trim(),
        dealId,
        dueDate: due || undefined,
        assigneeEmployeeId: assignee || undefined,
      });
      setTitle('');
      setDue('');
      toast.success('Task added.');
      await refreshTasks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add task');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(task: TaskItem) {
    setBusyId(task.id);
    try {
      await mutate(`/api/sales/tasks/${task.id}`, 'PATCH', {
        status: task.status === 'completed' ? 'open' : 'completed',
      });
      await refreshTasks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update task');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">Follow-up tasks</h3>
      <ul className="mb-3 space-y-1.5">
        {tasks.length === 0 ? (
          <li className="text-xs text-[var(--dash-text-muted)]">No tasks yet.</li>
        ) : (
          tasks.map((t) => {
            const overdue = t.status === 'open' && t.dueDate && new Date(t.dueDate) < new Date();
            return (
              <li key={t.id} className="flex items-center gap-2 rounded border border-[var(--dash-border)] px-2 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => void toggle(t)}
                  disabled={busyId === t.id}
                  aria-label={t.status === 'completed' ? 'Reopen task' : 'Complete task'}
                  className="shrink-0 text-[var(--dash-text-muted)] hover:text-[var(--stride-coral)]"
                >
                  {t.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </button>
                <span className={`min-w-0 flex-1 ${t.status === 'completed' ? 'text-[var(--dash-text-muted)] line-through' : 'text-[var(--dash-text-strong)]'}`}>
                  {t.title}
                </span>
                {t.dueDate ? (
                  <span className={`inline-flex shrink-0 items-center gap-1 ${overdue ? 'text-red-600' : 'text-[var(--dash-text-muted)]'}`}>
                    <Clock className="h-3 w-3" /> {formatShortDate(t.dueDate)}
                  </span>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
      <form
        className="space-y-2 rounded-lg border border-[var(--dash-border)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input required placeholder="New follow-up task" value={title} onChange={(e) => setTitle(e.target.value)} className="dash-auth-input w-full text-xs" />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="dash-auth-input w-full text-xs" />
          <StrideSelect
            value={assignee}
            onChange={setAssignee}
            options={[{ value: '', label: 'Unassigned' }, ...reps.map((r) => ({ value: r.id, label: r.name }))]}
            ariaLabel="Assignee"
            size="sm"
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-secondary inline-flex items-center gap-1 px-2.5 py-1.5 text-xs disabled:opacity-60">
            <Plus className="h-3.5 w-3.5" /> {saving ? 'Adding…' : 'Add task'}
          </button>
        </div>
      </form>
    </section>
  );
}

function StageHistorySection({ history }: { history: StageHistoryEntry[] }) {
  if (history.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">Stage history</h3>
      <ol className="space-y-1.5 border-l border-[var(--dash-border)] pl-4">
        {history.map((h) => (
          <li key={h.id} className="relative text-xs">
            <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-[var(--stride-coral)]" />
            <span className="text-[var(--dash-text-strong)]">
              {h.fromStage ? `${stageLabel(h.fromStage)} → ` : 'Created as '}
              {stageLabel(h.toStage)}
            </span>
            <span className="ml-2 text-[var(--dash-text-muted)]">{formatShortDate(h.changedAt)}</span>
            {h.changedBy ? <span className="ml-1 text-[var(--dash-text-muted)]">· {h.changedBy.name}</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Create deal modal                                                   */
/* ------------------------------------------------------------------ */

function CreateDealModal({
  reps,
  onClose,
  onCreated,
}: {
  reps: Rep[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('500000');
  const [stage, setStage] = useState<SalesDealStage>('lead');
  const [ownerEmployeeId, setOwnerEmployeeId] = useState('');
  const [accountsClientId, setAccountsClientId] = useState('');
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (reps[0] && !ownerEmployeeId) setOwnerEmployeeId(reps[0].id);
  }, [reps, ownerEmployeeId]);

  useEffect(() => {
    apiFetch<{ clients?: Array<{ id: string; name: string }> }>('/api/accounts/clients')
      .then((data) => setClients(data.clients ?? []))
      .catch(() => setClients([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await mutate('/api/sales/deals', 'POST', {
        name,
        value: Number(value),
        ownerEmployeeId,
        stage,
        probability: STAGE_DEFAULT_PROBABILITY[stage],
        accountsClientId: accountsClientId || undefined,
      });
      onCreated();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-[var(--stride-coral)]" />
          <h2 className="text-lg font-semibold text-[var(--dash-text-strong)]">New deal</h2>
        </div>
        <Field label="Name">
          <input required value={name} onChange={(e) => setName(e.target.value)} className="dash-auth-input w-full" />
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Value (KES)">
            <input required type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)} className="dash-auth-input w-full" />
          </Field>
          <Field label="Stage">
            <StrideSelect
              value={stage}
              onChange={(v) => setStage(v as SalesDealStage)}
              options={SALES_DEAL_STAGES.map((s) => ({ value: s, label: stageLabel(s) }))}
              ariaLabel="Stage"
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Owner">
            <StrideSelect
              value={ownerEmployeeId}
              onChange={setOwnerEmployeeId}
              options={reps.map((r) => ({ value: r.id, label: r.name }))}
              ariaLabel="Owner"
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Finance account">
            <StrideSelect
              value={accountsClientId}
              onChange={setAccountsClientId}
              options={[{ value: '', label: 'None' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
              ariaLabel="Finance account"
            />
          </Field>
        </div>
        {err ? <p className="mt-3 text-xs text-red-600">{err}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3 py-2 text-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Create deal'}
          </button>
        </div>
      </form>
    </div>
  );
}
