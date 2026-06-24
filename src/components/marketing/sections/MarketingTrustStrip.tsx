import { INDUSTRY_VERTICALS } from '@/lib/marketing-config';
import { MarketingReveal } from '@/components/marketing/MarketingReveal';

export function MarketingTrustStrip() {
  return (
    <section className="relative z-[2] bg-pub-ink px-6 pb-20 pt-10 sm:px-10">
      <p className="mb-6 text-center text-xs uppercase tracking-[0.12em] text-pub-ink-subtle">
        Sectors we build for
      </p>
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-center gap-x-12 gap-y-4">
        {INDUSTRY_VERTICALS.map((vertical, i) => (
          <MarketingReveal key={vertical.id} delay={i * 0.08}>
            <span className="font-heading text-lg font-bold tracking-[-0.5px] text-[#F0EFE9]/40 transition-colors hover:text-[#F0EFE9]/75 md:text-[19px]">
              {vertical.name}
            </span>
          </MarketingReveal>
        ))}
      </div>
    </section>
  );
}
