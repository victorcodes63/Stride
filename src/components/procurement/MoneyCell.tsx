import { formatProcurementMoney } from '@/lib/procurement/types';

function cn(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Right-aligned, tabular currency value using the canonical procurement money formatter.
 * Presentational only — render inside a `<td>` or any flex/grid cell.
 */
export function MoneyCell({
  amount,
  currency = 'KES',
  muted = false,
  strong = false,
  className,
}: {
  amount: number | null | undefined;
  currency?: string;
  /** Dim the value (e.g. zero / derived rows). */
  muted?: boolean;
  /** Emphasize the value (e.g. totals). */
  strong?: boolean;
  className?: string;
}) {
  if (amount == null) {
    return <span className={cn('block text-right tabular-nums text-[var(--dash-text-muted)]', className)}>—</span>;
  }
  return (
    <span
      className={cn(
        'block text-right tabular-nums',
        strong ? 'font-semibold text-[var(--dash-text-strong)]' : 'text-[var(--dash-text-body)]',
        muted && 'text-[var(--dash-text-muted)]',
        className,
      )}
    >
      {formatProcurementMoney(currency, amount)}
    </span>
  );
}
