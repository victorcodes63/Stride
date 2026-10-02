/**
 * Endless ticker of real capabilities — every item must be true of the product today.
 * Pure CSS animation; pauses on hover and stops under prefers-reduced-motion.
 */
const CAPABILITIES = [
  'PAYE',
  'NSSF',
  'SHIF',
  'Housing Levy',
  'M-Pesa bulk payouts',
  'P9 & iTax exports',
  'Multi-entity · Kenya + Uganda',
  'Employee self-service',
  'Leave & attendance',
  'Approvals & audit trail',
  'Invoicing & ledger',
  'ODPC-ready data handling',
] as const;

function TickerRow({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {CAPABILITIES.map((item) => (
        <li
          key={item}
          className="flex items-center whitespace-nowrap px-7 text-[15px] font-medium tracking-[-0.01em] text-[var(--sc-ink)] sm:text-[16px]"
        >
          <span className="mr-7 h-1.5 w-1.5 rounded-full bg-[var(--sc-coral)]" aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function HomeCapabilityTicker() {
  return (
    <section
      aria-label="What Stride handles"
      className="group relative overflow-hidden bg-white py-7 sm:py-8"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent sm:w-40"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent sm:w-40"
        aria-hidden
      />
      <div className="flex w-max animate-[stride-ticker_48s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        <TickerRow />
        <TickerRow hidden />
      </div>
    </section>
  );
}
