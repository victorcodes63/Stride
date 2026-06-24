'use client';

import { DEMO_FLEET_TRIPS } from './demo-data';

const COLUMN_ORDER = ['Planned', 'In transit', 'Delivered'] as const;

const STATUS_CHIP: Record<(typeof COLUMN_ORDER)[number], string> = {
  Planned: 'border-white/15 bg-white/10 text-white/60',
  'In transit': 'border-[#FF5436]/40 bg-[#FF5436]/10 text-[#FF8A6E]',
  Delivered: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
};

export function FleetBoardMockup({ className = '' }: { className?: string }) {
  const columns = COLUMN_ORDER.map((label) => ({
    label,
    cards: DEMO_FLEET_TRIPS.filter((trip) => trip.status === label),
  }));
  const activeTrips = DEMO_FLEET_TRIPS.filter((trip) => trip.status === 'In transit').length;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#E6DED4] bg-[#1A1714] shadow-[0_24px_60px_-24px_rgba(26,23,20,0.35)] ${className}`.trim()}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5 sm:px-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
            Fleet & Logistics
          </p>
          <p className="text-xs font-medium text-white">Trip board</p>
        </div>
        <span className="rounded-full bg-[#FF5436]/20 px-2 py-0.5 text-[9px] font-medium text-[#FF8A6E]">
          {activeTrips} active
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto p-2.5 sm:p-3">
        {columns.map((column) => (
          <section
            key={column.label}
            className="min-w-[108px] flex-1 rounded-lg border border-white/10 bg-white/[0.04]"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-2 py-1.5">
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
                      ? 'border-[#FF5436]/40 bg-[#FF5436]/10'
                      : 'border-white/10 bg-white/[0.06]'
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
    </div>
  );
}
