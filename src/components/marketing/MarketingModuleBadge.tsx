import type { MarketingModuleReadiness } from '@/lib/marketing-config';
import { MARKETING_READINESS_META } from '@/lib/marketing-config';

type MarketingModuleBadgeProps = {
  readiness: MarketingModuleReadiness;
  /** Dark backgrounds (platform hero mockups). */
  variant?: 'light' | 'dark';
  className?: string;
};

export function MarketingModuleBadge({
  readiness,
  variant = 'light',
  className = '',
}: MarketingModuleBadgeProps) {
  const meta = MARKETING_READINESS_META[readiness];
  const dark =
    variant === 'dark'
      ? readiness === 'live'
        ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100'
        : readiness === 'partial'
          ? 'border-amber-400/30 bg-amber-500/15 text-amber-100'
          : 'border-white/15 bg-white/10 text-white/55'
      : meta.badgeClass;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${dark} ${className}`.trim()}
      title={meta.title}
    >
      {meta.label}
    </span>
  );
}

export function MarketingReadinessLegend({ className = '' }: { className?: string }) {
  const items: MarketingModuleReadiness[] = ['live', 'partial', 'roadmap'];
  return (
    <p className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[var(--sc-ink-muted)] ${className}`.trim()}>
      <span className="font-medium text-[var(--sc-ink)]">Module status:</span>
      {items.map((key) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <MarketingModuleBadge readiness={key} />
          <span>{MARKETING_READINESS_META[key].title}</span>
        </span>
      ))}
    </p>
  );
}
