'use client';

import { DEMO_FLEET_TRIPS } from './demo-data';

const COLUMN_ORDER = ['Planned', 'In transit', 'Delivered'] as const;

const STATUS_CHIP: Record<(typeof COLUMN_ORDER)[number], string> = {
  Planned: 'border-white/15 bg-white/10 text-white/60',
  'In transit': 'border-[var(--sc-coral)]/35 bg-[var(--sc-coral)]/15 text-[#FF8A6E]',
  Delivered: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
};

export function FleetBoardWireframe({ className = '' }: { className?: string }) {
  const columns = COLUMN_ORDER.map((label) => ({
    label,
    cards: DEMO_FLEET_TRIPS.filter((trip) => trip.status === label),
  }));

  return (
    <div className={`flex h-full min-h-[200px] gap-2 overflow-x-auto ${className}`.trim()}>
      {columns.map((column) => (
        <section
          key={column.label}
          className="min-w-[100px] flex-1 rounded-lg border border-white/[0.1] bg-white/[0.03]"
        >
          <header className="flex items-center justify-between border-b border-white/[0.08] px-2 py-1.5">
            <h3 className="text-[8px] font-semibold uppercase tracking-wide text-white/55">
              {column.label}
            </h3>
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[8px] text-white/60">
              {column.cards.length}
            </span>
          </header>
          <ul className="space-y-1.5 p-1.5">
            {column.cards.map((card) => (
              <li
                key={card.ref}
                className={`rounded-md border px-2 py-1.5 ${
                  card.active
                    ? 'border-[var(--sc-coral)]/35 bg-[var(--sc-coral)]/10'
                    : 'border-white/[0.08] bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[9px] font-semibold text-white">{card.ref}</p>
                  <span
                    className={`rounded px-1 py-0.5 text-[6px] font-semibold uppercase tracking-wide ${STATUS_CHIP[column.label]}`}
                  >
                    {column.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[8px] leading-snug text-white/60">{card.route}</p>
                <p className="mt-1 text-[8px] font-medium text-[#FF8A6E]">{card.vehicle}</p>
                <p className="mt-0.5 text-[7px] text-white/45">{card.driver}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
