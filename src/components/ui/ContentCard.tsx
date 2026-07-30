import type { ReactNode } from 'react';

type ContentCardProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md';
};

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
} as const;

/** Elevated surface card for platform workspaces. */
export default function ContentCard({
  children,
  title,
  description,
  actions,
  className = '',
  padding = 'md',
}: ContentCardProps) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`.trim()}
    >
      {title || actions ? (
        <div className="flex flex-col gap-3 border-b border-neutral-100 bg-neutral-50/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-primary-900">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div className={PADDING[padding]}>{children}</div>
    </section>
  );
}
