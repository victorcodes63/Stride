import { CORE_MODULES } from '@/lib/marketing-config';
import { MarketingEyebrow } from '@/components/marketing/MarketingEyebrow';
import { MarketingReveal } from '@/components/marketing/MarketingReveal';

export function MarketingCoreSection() {
  return (
    <section id="core" className="bg-pub-surface px-6 py-[80px] sm:px-10 lg:py-[120px]">
      <div className="mx-auto max-w-[1120px]">
        <MarketingReveal>
          <MarketingEyebrow>The platform</MarketingEyebrow>
        </MarketingReveal>
        <MarketingReveal delay={0.08}>
          <h2 className="max-w-[640px] font-heading text-[clamp(1.875rem,4vw,3.125rem)] font-extrabold leading-[1.06] tracking-[-1.5px] text-pub-ink">
            The foundation every
            <br />
            business <span className="text-[var(--pub-primary)]">runs on.</span>
          </h2>
        </MarketingReveal>
        <MarketingReveal delay={0.16}>
          <p className="mt-[18px] max-w-[540px] text-[17px] leading-relaxed text-pub-ink-muted">
            Six universal modules, one data layer, one login. Start with what you need today and
            switch on the rest as you grow.
          </p>
        </MarketingReveal>

        <div className="mt-[60px] grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CORE_MODULES.map((mod, i) => (
            <MarketingReveal key={mod.name} delay={0.08 * (i + 1)}>
              <article className="h-full rounded-2xl border border-pub-border bg-pub-surface p-7 transition hover:-translate-y-1 hover:border-pub-border-strong hover:shadow-[0_18px_44px_rgba(26,23,20,0.08)]">
                <p className="mb-4 font-heading text-[13px] font-bold tracking-[0.04em] text-[var(--pub-primary)]">
                  {mod.num}
                </p>
                <h3 className="mb-2 font-heading text-[19px] font-bold tracking-[-0.4px] text-pub-ink">
                  {mod.name}
                </h3>
                <p className="text-sm leading-relaxed text-pub-ink-muted">{mod.description}</p>
              </article>
            </MarketingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
