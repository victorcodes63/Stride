'use client';

import Link from 'next/link';
import { PRICING_FOOTNOTE } from '@/lib/pricing';
import { Reveal } from '@/components/marketing/motion';
import { PricingPlanCards } from '@/components/marketing/pricing/PricingPlanCards';
import { SectionBadge, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';

export function MarketingPricingSection() {
  return (
    <section id="pricing" className="scroll-anchor bg-[var(--sc-paper-2)] py-16 sm:py-20 lg:py-28">
      <StudioCraftContainer>
        <div className="text-center">
          <Reveal className="flex justify-center">
            <SectionBadge number="6" label="Pricing" />
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mx-auto max-w-[640px] text-[clamp(2rem,4.5vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
              Pay per <span className="text-[var(--sc-coral)]">employee</span>, with no minimum.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-5 max-w-[520px] text-base leading-relaxed text-[var(--sc-ink-muted)] sm:text-lg">
              One rate per active employee per month, billed in Kenyan shillings. Your bill grows only
              as your team does.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.14} className="mx-auto mt-12 max-w-[1180px] sm:mt-14 lg:mt-16">
          {/* Same component as /pricing so the two can never drift apart. */}
          <PricingPlanCards />
        </Reveal>

        <Reveal delay={0.12} className="mt-10 text-center">
          <p className="mx-auto max-w-[720px] text-[13px] text-[var(--sc-ink-muted)]">
            {PRICING_FOOTNOTE} Prices exclusive of VAT.{' '}
            <Link
              href="/pricing"
              className="font-semibold text-[var(--sc-coral)] transition-colors hover:text-[var(--sc-coral-deep)]"
            >
              View full pricing →
            </Link>
          </p>
        </Reveal>
      </StudioCraftContainer>
    </section>
  );
}
