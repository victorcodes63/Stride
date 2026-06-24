import Link from 'next/link';
import { INDUSTRY_VERTICALS } from '@/lib/marketing-config';
import { MarketingEyebrow } from '@/components/marketing/MarketingEyebrow';
import { MarketingReveal } from '@/components/marketing/MarketingReveal';

export function MarketingIndustriesBento() {
  const live = INDUSTRY_VERTICALS.find((v) => v.status === 'available');
  const comingSoon = INDUSTRY_VERTICALS.filter((v) => v.status === 'coming_soon');

  return (
    <section id="industries" className="bg-pub-surface px-6 py-[80px] sm:px-10 lg:py-[120px]">
      <div className="mx-auto max-w-[1120px]">
        <MarketingReveal>
          <MarketingEyebrow>Built for your industry</MarketingEyebrow>
        </MarketingReveal>
        <MarketingReveal delay={0.08}>
          <h2 className="max-w-[640px] font-heading text-[clamp(1.875rem,4vw,3.125rem)] font-extrabold leading-[1.06] tracking-[-1.5px] text-pub-ink">
            Then it gets <span className="text-[var(--pub-primary)]">specific.</span>
          </h2>
        </MarketingReveal>
        <MarketingReveal delay={0.16}>
          <p className="mt-[18px] max-w-[540px] text-[17px] leading-relaxed text-pub-ink-muted">
            The core runs every business. Vertical modules add the depth your sector actually needs
            — starting with logistics, with more rolling out.
          </p>
        </MarketingReveal>

        <div className="mt-[60px] grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
          {live ? (
            <MarketingReveal className="lg:col-span-1 lg:row-span-2" delay={0.1}>
              <article className="pub-on-ink relative flex h-full min-h-[240px] flex-col justify-between overflow-hidden rounded-[18px] bg-pub-ink p-8 transition hover:-translate-y-1">
                <div>
                  <span className="inline-flex rounded-full bg-[var(--pub-primary)]/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--pub-primary)]">
                    Available now
                  </span>
                  <h3 className="mt-[18px] font-heading text-[30px] font-bold tracking-[-0.6px]">
                    {live.name}
                  </h3>
                  <p className="mt-2.5 max-w-[340px] text-sm leading-relaxed text-[#F0EFE9]/70">
                    {live.description}
                  </p>
                </div>
                <Link
                  href={live.href}
                  className="mt-[18px] text-sm font-semibold text-[var(--pub-primary)] transition hover:text-[#FF8A6E]"
                >
                  See the fleet module →
                </Link>
              </article>
            </MarketingReveal>
          ) : null}

          {comingSoon.map((vertical, i) => (
            <MarketingReveal key={vertical.id} delay={0.12 + i * 0.06}>
              <article className="flex h-full min-h-[240px] flex-col justify-between rounded-[18px] border border-pub-border bg-white p-8 transition hover:-translate-y-1">
                <div>
                  <span className="inline-flex rounded-full bg-pub-surface-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-pub-ink-subtle">
                    Coming soon
                  </span>
                  <h3 className="mt-[18px] font-heading text-2xl font-bold tracking-[-0.6px] text-pub-ink">
                    {vertical.name}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-pub-ink-muted">
                    {vertical.features.slice(0, 3).join(', ')}.
                  </p>
                </div>
                <Link
                  href={vertical.href}
                  className="mt-4 text-sm font-semibold text-[var(--pub-primary)] transition hover:text-[var(--pub-primary-hover)]"
                >
                  Join waitlist →
                </Link>
              </article>
            </MarketingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
