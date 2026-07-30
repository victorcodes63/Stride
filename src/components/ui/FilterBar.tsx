import type { ReactNode } from 'react';

type FilterBarProps = {
  children?: ReactNode;
  label?: string;
  trailing?: ReactNode;
  className?: string;
};

/** Consistent filter/toolbar row for list pages. */
export default function FilterBar({
  children,
  label = 'Filters',
  trailing,
  className = '',
}: FilterBarProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white bg-clip-padding p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4 ${className}`.trim()}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</span>
        {children}
      </div>
      {trailing ? <div className="flex shrink-0 flex-wrap items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
