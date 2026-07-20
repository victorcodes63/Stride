'use client';

/** Five-dot meter showing a required or achieved competency level (1–5). */
export function CompetencyMeter({
  level,
  max = 5,
  showValue = true,
  filledColor = 'var(--dash-text-strong)',
  emptyColor = 'var(--dash-border)',
}: {
  level: number;
  max?: number;
  showValue?: boolean;
  filledColor?: string;
  emptyColor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Level ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: i < level ? filledColor : emptyColor }}
        />
      ))}
      {showValue ? (
        <span className="ml-1 text-xs font-medium text-[var(--dash-text-muted)]">
          {level}/{max}
        </span>
      ) : null}
    </div>
  );
}
