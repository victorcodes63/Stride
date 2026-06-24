import {
  CORE_CAPABILITIES,
  CORE_PACKS_EXPLAINER,
  VERTICAL_PACKS,
} from '@/components/marketing/industries/industries-content';
import { INDUSTRY_VERTICALS } from '@/lib/marketing-config';

const PACK_STATUS = Object.fromEntries(INDUSTRY_VERTICALS.map((v) => [v.id, v.status])) as Record<
  string,
  'available' | 'coming_soon'
>;

const NATIVE_BUILT_INS = ['M-Pesa native', 'KRA · NSSF · SHIF', 'Multi-entity', 'Kenya & Uganda'] as const;

export function WhyStrideArchitectureVisual({ className = '' }: { className?: string }) {
  const packCount = VERTICAL_PACKS.length;

  return (
    <figure
      className={`overflow-hidden rounded-2xl border border-[var(--sc-line)] bg-[var(--sc-paper)] shadow-[0_24px_60px_rgba(26,23,20,0.08)] ${className}`.trim()}
    >
      <figcaption className="sr-only">
        Stride horizontal core with East African compliance built in, and vertical industry packs layered
        on top — one login, no separate integration project.
      </figcaption>

      <div className="border-b border-[var(--sc-line)] bg-[var(--sc-paper-2)] px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--sc-ink-muted)] sm:text-[11px]">
            How Stride is structured
          </p>
          <span className="rounded-full border border-[var(--sc-coral)]/20 bg-[var(--sc-coral)]/[0.08] px-2.5 py-0.5 text-[10px] font-medium text-[var(--sc-coral)]">
            One login
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 rounded-lg border border-dashed border-[var(--sc-line)] bg-[var(--sc-paper-2)]/80 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--sc-ink-muted)]">
            Built in, not bolted on
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {NATIVE_BUILT_INS.map((item) => (
              <span
                key={item}
                className="rounded-md border border-[var(--sc-coral)]/20 bg-[var(--sc-coral)]/[0.07] px-2 py-0.5 text-[10px] font-medium text-[var(--sc-coral)]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2" aria-hidden>
          <div className="rounded-xl border border-[var(--sc-line)] bg-[var(--sc-ink)] p-4 text-white">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50">
              {CORE_PACKS_EXPLAINER.coreLabel}
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--sc-paper)]">Horizontal operations layer</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CORE_CAPABILITIES.map((cap) => (
                <span
                  key={cap}
                  className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/90 sm:text-[11px]"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>

          {VERTICAL_PACKS.map((pack, index) => {
            const isLive = PACK_STATUS[pack.id] === 'available';

            return (
              <div
                key={pack.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--sc-line)] bg-white px-3.5 py-2.5 shadow-sm sm:px-4 sm:py-3"
                style={{
                  marginLeft: `${index * 6}px`,
                  marginRight: `${(packCount - 1 - index) * 6}px`,
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: pack.color }}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium text-[var(--sc-ink)]">{pack.label}</span>
                </div>
                <span
                  className={
                    isLive
                      ? 'shrink-0 rounded-full bg-[var(--sc-coral)]/[0.1] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--sc-coral)]'
                      : 'shrink-0 text-[9px] font-medium uppercase tracking-[0.06em] text-[var(--sc-ink-muted)]'
                  }
                >
                  {isLive ? 'Live' : 'Roadmap'}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-[12px] leading-relaxed text-[var(--sc-ink-muted)] sm:text-[13px]">
          {CORE_PACKS_EXPLAINER.caption}
        </p>
      </div>
    </figure>
  );
}
