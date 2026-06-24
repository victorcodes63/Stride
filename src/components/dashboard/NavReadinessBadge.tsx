import type { NavReadiness } from '@/lib/dashboard-nav-readiness';
import { NAV_READINESS_META } from '@/lib/dashboard-nav-readiness';

export function NavReadinessBadge({
  readiness,
  compact = false,
  hero = false,
}: {
  readiness: NavReadiness;
  compact?: boolean;
  /** Glass pill styling for module hero banners. */
  hero?: boolean;
}) {
  if (readiness === 'live') return null;

  const meta = NAV_READINESS_META[readiness];

  if (hero) {
    return (
      <span
        className={`dash-hero-readiness-badge ${compact ? 'dash-hero-readiness-badge--compact' : ''}`}
        title={meta.title}
      >
        {meta.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full font-semibold uppercase tracking-wide ${meta.className} ${
        compact ? 'px-1.5 py-px text-[9px]' : 'px-2 py-0.5 text-[10px]'
      }`}
      title={meta.title}
    >
      {meta.label}
    </span>
  );
}
