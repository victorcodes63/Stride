'use client';

import type { Icon } from '@phosphor-icons/react';
import {
  Buildings,
  CalendarCheck,
  DeviceMobile,
  FileArrowUp,
  FirstAidKit,
  HouseLine,
  IdentificationCard,
  LockKey,
  Notebook,
  PiggyBank,
  Receipt,
  ShieldCheck,
} from '@phosphor-icons/react';

/**
 * Endless ticker of real capabilities — every item must be true of the product today.
 * Keyframes live in this component so the animation can never go missing with a stylesheet.
 * Pauses on hover; stops under prefers-reduced-motion.
 */
const CAPABILITIES: readonly { label: string; icon: Icon }[] = [
  { label: 'PAYE', icon: Receipt },
  { label: 'NSSF', icon: PiggyBank },
  { label: 'SHIF', icon: FirstAidKit },
  { label: 'Housing Levy', icon: HouseLine },
  { label: 'M-Pesa bulk payouts', icon: DeviceMobile },
  { label: 'P9 & iTax exports', icon: FileArrowUp },
  { label: 'Multi-entity · Kenya + Uganda', icon: Buildings },
  { label: 'Employee self-service', icon: IdentificationCard },
  { label: 'Leave & attendance', icon: CalendarCheck },
  { label: 'Approvals & audit trail', icon: ShieldCheck },
  { label: 'Invoicing & ledger', icon: Notebook },
  { label: 'ODPC-ready data handling', icon: LockKey },
];

const TICKER_CSS = `
@keyframes stride-capability-ticker { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }
.stride-capability-ticker { animation: stride-capability-ticker 52s linear infinite; }
.group:hover .stride-capability-ticker { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .stride-capability-ticker { animation: none; } }
`;

function TickerRow({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {CAPABILITIES.map(({ label, icon: ItemIcon }) => (
        <li
          key={label}
          className="flex items-center gap-3 whitespace-nowrap px-8 text-[15px] font-medium tracking-[-0.01em] text-[var(--sc-ink)] sm:text-[16px]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--sc-coral)]/10 text-[var(--sc-coral)]">
            <ItemIcon size={17} weight="duotone" aria-hidden />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

export function HomeCapabilityTicker() {
  return (
    <section aria-label="What Stride handles" className="group relative overflow-hidden bg-white py-7 sm:py-8">
      <style>{TICKER_CSS}</style>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent sm:w-40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent sm:w-40"
        aria-hidden
      />
      <div className="stride-capability-ticker flex w-max">
        <TickerRow />
        <TickerRow hidden />
      </div>
    </section>
  );
}
