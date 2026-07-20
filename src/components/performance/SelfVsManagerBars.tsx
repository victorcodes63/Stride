'use client';

export type ComparisonRow = {
  label: string;
  self: number | null;
  manager: number | null;
  weightPercent?: number | null;
};

function Track({ score, color }: { score: number | null; color: string }) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, (score / 5) * 100));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: 'var(--dash-surface-muted)' }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

const SELF_COLOR = 'color-mix(in srgb, var(--swatch-sky-accent) 70%, var(--dash-surface-solid))';
const MANAGER_COLOR = 'var(--swatch-coral-accent)';

/** Side-by-side self vs manager score comparison per dimension/goal. */
export function SelfVsManagerBars({
  rows,
  emptyLabel = 'No dimensions to compare yet.',
}: {
  rows: ComparisonRow[];
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-[var(--dash-text-muted)]">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-[11px] text-[var(--dash-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SELF_COLOR }} aria-hidden />
          Self
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MANAGER_COLOR }} aria-hidden />
          Manager
        </span>
      </div>
      <ul className="space-y-3">
        {rows.map((row) => {
          const gap =
            row.self != null && row.manager != null ? Number((row.manager - row.self).toFixed(1)) : null;
          return (
            <li key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-medium text-[var(--dash-text-body)]">
                  {row.label}
                  {row.weightPercent != null ? (
                    <span className="ml-1 text-[var(--dash-text-muted)]">· {row.weightPercent}%</span>
                  ) : null}
                </span>
                {gap != null && gap !== 0 ? (
                  <span
                    className="shrink-0 text-[11px] font-semibold tabular-nums"
                    style={{ color: gap > 0 ? 'var(--swatch-emerald-accent)' : 'var(--swatch-rose-accent)' }}
                  >
                    {gap > 0 ? '+' : ''}
                    {gap}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                <span className="w-14 text-[11px] text-[var(--dash-text-muted)]">Self</span>
                <Track score={row.self} color={SELF_COLOR} />
                <span className="w-8 text-right text-xs font-semibold tabular-nums text-[var(--dash-text-strong)]">
                  {row.self != null ? `${row.self}` : '—'}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-[auto_1fr_auto] items-center gap-2">
                <span className="w-14 text-[11px] text-[var(--dash-text-muted)]">Manager</span>
                <Track score={row.manager} color={MANAGER_COLOR} />
                <span className="w-8 text-right text-xs font-semibold tabular-nums text-[var(--dash-text-strong)]">
                  {row.manager != null ? `${row.manager}` : '—'}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
