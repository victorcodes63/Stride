'use client';

import { useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import type { PricingCompareCell } from '@/lib/marketing-config';
import { PRICING_COMPARE_GROUPS } from '@/lib/marketing-config';

const TIER_LABELS = ['Starter', 'Growth', 'Enterprise'] as const;

const MARK_LABELS: Record<'included' | 'addon' | 'none', string> = {
  included: 'Included',
  addon: 'Available as add-on',
  none: 'Not in tier',
};

function CompareCell({ cell }: { cell: PricingCompareCell }) {
  if (cell.type === 'text') {
    return <span className="text-sm leading-snug text-pub-ink-muted">{cell.value}</span>;
  }

  const symbol = cell.value === 'included' ? '✓' : cell.value === 'addon' ? '➕' : '—';
  const colorClass =
    cell.value === 'included'
      ? 'text-[var(--pub-primary)]'
      : cell.value === 'addon'
        ? 'text-pub-ink-muted'
        : 'text-pub-ink-subtle';

  return (
    <span className={`text-base font-semibold ${colorClass}`} aria-label={MARK_LABELS[cell.value]}>
      {symbol}
    </span>
  );
}

function CompareGroup({
  title,
  rows,
  defaultOpen,
}: {
  title: string;
  rows: (typeof PRICING_COMPARE_GROUPS)[number]['rows'];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `pricing-compare-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="border-b border-pub-border last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pub-primary)]/30 focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="font-heading text-sm font-bold text-pub-ink sm:text-base">{title}</span>
        <CaretDown
          size={16}
          weight="bold"
          className={`shrink-0 text-pub-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div id={panelId} className="pb-4">
          <div className="hidden overflow-x-auto rounded-xl border border-pub-border bg-white sm:block">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-pub-border bg-[var(--pub-paper-2,#FBF8F4)]">
                  <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-pub-ink-subtle">
                    Feature
                  </th>
                  {TIER_LABELS.map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="w-28 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-pub-ink-subtle"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-pub-border/70 last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-sm font-medium leading-snug text-pub-ink">
                      {row.label}
                    </th>
                    <td className="px-4 py-3 text-center">
                      <CompareCell cell={row.starter} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CompareCell cell={row.growth} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CompareCell cell={row.enterprise} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 sm:hidden">
            {rows.map((row) => (
              <div key={row.label} className="rounded-xl border border-pub-border bg-white p-4">
                <p className="text-sm font-medium leading-snug text-pub-ink">{row.label}</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {(
                    [
                      ['Starter', row.starter],
                      ['Growth', row.growth],
                      ['Enterprise', row.enterprise],
                    ] as const
                  ).map(([tier, cell]) => (
                    <div key={tier}>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-pub-ink-subtle">
                        {tier}
                      </dt>
                      <dd className="mt-1 flex justify-center">
                        <CompareCell cell={cell} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PricingCompareMatrix() {
  return (
    <section className="mt-16" aria-labelledby="pricing-compare-heading">
      <div className="text-center">
        <h2
          id="pricing-compare-heading"
          className="font-heading text-[clamp(1.5rem,4vw,2rem)] font-extrabold tracking-[-0.02em] text-pub-ink"
        >
          Compare features
        </h2>
        <p className="mx-auto mt-3 max-w-[36rem] text-sm leading-relaxed text-pub-ink-muted">
          Exactly what each tier unlocks by default — horizontal and vertical modules show as add-ons on
          Starter where that is honest.
        </p>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-pub-ink-subtle">
          <span>
            <span className="font-semibold text-[var(--pub-primary)]">✓</span> included
          </span>
          <span>
            <span className="font-semibold text-pub-ink-muted">➕</span> available as add-on
          </span>
          <span>
            <span className="font-semibold text-pub-ink-subtle">—</span> not in tier
          </span>
        </p>
      </div>

      <div className="mt-8 rounded-[20px] border border-pub-border bg-white px-4 sm:px-6">
        {PRICING_COMPARE_GROUPS.map((group, index) => (
          <CompareGroup
            key={group.id}
            title={group.title}
            rows={group.rows}
            defaultOpen={index === 0}
          />
        ))}
      </div>
    </section>
  );
}
