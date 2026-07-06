import type { MarketingModuleChip } from '@/lib/marketing-module-map';
import { MarketingModuleBadge } from '@/components/marketing/MarketingModuleBadge';

type MarketingModuleChipsProps = {
  modules: readonly MarketingModuleChip[];
  variant?: 'light' | 'dark';
  className?: string;
};

/** Per-module chips with honest Live / Partial / Roadmap badges (MKT-02). */
export function MarketingModuleChips({
  modules,
  variant = 'light',
  className = '',
}: MarketingModuleChipsProps) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {modules.map((mod) => (
        <li
          key={mod.key}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
            variant === 'dark'
              ? 'border-white/10 bg-white/[0.04]'
              : 'border-[var(--sc-line)] bg-[var(--sc-paper)]'
          }`}
        >
          <span
            className={`text-[11px] font-medium ${
              variant === 'dark' ? 'text-white/85' : 'text-[var(--sc-ink)]'
            }`}
          >
            {mod.label}
          </span>
          <MarketingModuleBadge readiness={mod.readiness} variant={variant} />
        </li>
      ))}
    </ul>
  );
}
