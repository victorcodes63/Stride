'use client';

import { Flame, Snowflake, Sun, Clock } from 'lucide-react';
import { stageLabel, type SalesDealStage, type SalesLeadRating } from '@/lib/sales/schema';

const BADGE_BASE =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

const STAGE_TONE: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20',
  qualified:
    'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20',
  proposal:
    'bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/20',
  negotiation:
    'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20',
  won: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20',
  lost: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20',
};

export function SalesStageBadge({ stage }: { stage: string }) {
  const tone = STAGE_TONE[stage] ?? STAGE_TONE.lead;
  return <span className={`${BADGE_BASE} ${tone}`}>{stageLabel(stage)}</span>;
}

const RATING_META: Record<SalesLeadRating, { label: string; tone: string; Icon: typeof Flame }> = {
  hot: {
    label: 'Hot',
    tone: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20',
    Icon: Flame,
  },
  warm: {
    label: 'Warm',
    tone: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20',
    Icon: Sun,
  },
  cold: {
    label: 'Cold',
    tone: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20',
    Icon: Snowflake,
  },
};

export function LeadRatingBadge({ rating }: { rating: SalesLeadRating | string }) {
  const meta = RATING_META[(rating as SalesLeadRating)] ?? RATING_META.cold;
  const { Icon } = meta;
  return (
    <span className={`${BADGE_BASE} ${meta.tone}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

const QUOTE_TONE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20',
  sent: 'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20',
  accepted:
    'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20',
  rejected:
    'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20',
  expired:
    'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20',
};

export function QuoteStatusBadge({ status }: { status: string }) {
  const tone = QUOTE_TONE[status] ?? QUOTE_TONE.draft;
  return <span className={`${BADGE_BASE} ${tone} capitalize`}>{status}</span>;
}

/** Shows how long a deal has been idle; amber when warning, rose when rotting. */
export function RottingBadge({ idleDays, rotting }: { idleDays: number | null; rotting: boolean }) {
  if (idleDays == null) return null;
  const tone = rotting
    ? 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/20'
    : idleDays >= 5
      ? 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20'
      : 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:ring-slate-500/20';
  return (
    <span className={`${BADGE_BASE} ${tone}`} title={rotting ? 'This deal is going stale' : 'Days idle'}>
      <Clock className="h-3 w-3" />
      {idleDays}d idle
    </span>
  );
}

export type { SalesDealStage };
