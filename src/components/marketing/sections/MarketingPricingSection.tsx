'use client';

import Link from 'next/link';
import { PRICING_TIERS } from '@/lib/marketing-config';
import { Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import {
  MarketingOutlineLink,
  MarketingPrimaryLink,
  SectionBadge,
  StudioCraftContainer,
} from '@/components/marketing/v3/studio-craft-shared';

function tierCardClass(featured: boolean) {
  return `relative flex h-full flex-col rounded-[20px] border p-5 text-center transition hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(26,23,20,0.09)] sm:p-8 lg:p-9 ${
    featured
      ? 'sc-on-ink border-[var(--sc-ink)] bg-[var(--sc-ink)]'
      : 'border-[var(--sc-line)] bg-white'
  }`;
}

export function MarketingPricingSection() {
  return (
    <section id="pricing" className="bg-[var(--sc-paper-2)] py-16 sm:py-20 lg:py-28">
      <StudioCraftContainer>
        <div className="text-center">
          <Reveal className="flex justify-center">
            <SectionBadge number="6" label="Pricing" />
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mx-auto max-w-[640px] text-[clamp(2rem,4.5vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
              Priced for your <span className="text-[var(--sc-coral)]">size</span>, not per seat.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-5 max-w-[520px] text-base leading-relaxed text-[var(--sc-ink-muted)] sm:text-lg">
              Platform tiers banded by organisation size, billed in Kenyan shillings. Add modules as you
              grow.
            </p>
          </Reveal>
        </div>

        <Stagger
          className="mt-10 grid gap-4 sm:mt-12 sm:gap-5 lg:mt-14 lg:grid-cols-3 lg:gap-6"
          delayChildren={0.14}
        >
          {PRICING_TIERS.map((tier) => (
            <StaggerItem key={tier.id} as="article" className={tierCardClass(tier.featured)}>
              {tier.featured ? (
                <span className="mx-auto mb-4 inline-flex rounded-full bg-[var(--sc-coral)]/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--sc-coral)] sm:text-[11px]">
                  Most popular
                </span>
              ) : null}
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--sc-coral)]">
                {tier.name}
              </p>
              <p
                className={`mt-3 text-[2rem] font-medium leading-none tracking-[-0.03em] sm:mt-4 sm:text-[2.5rem] ${
                  tier.featured ? 'text-[var(--sc-paper)]' : 'text-[var(--sc-ink)]'
                }`}
              >
                {tier.price}
              </p>
              <p
                className={`mt-2 text-[13px] ${
                  tier.featured ? 'text-[#9C948A]' : 'text-[var(--sc-ink-muted)]'
                }`}
              >
                {tier.unit}
              </p>
              <p
                className={`my-6 border-b pb-6 text-sm leading-relaxed ${
                  tier.featured
                    ? 'border-white/10 text-[#C9C0B6]'
                    : 'border-[var(--sc-line)] text-[var(--sc-ink-muted)]'
                }`}
              >
                {tier.description}
              </p>
              <ul
                className={`mx-auto mb-8 flex w-full max-w-[16rem] flex-1 flex-col gap-2.5 text-left text-sm sm:max-w-[18rem] ${
                  tier.featured ? 'text-[#D8D2C9]' : 'text-[var(--sc-ink-muted)]'
                }`}
              >
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 leading-snug">
                    <span className="mt-0.5 shrink-0 text-[var(--sc-coral)]">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {tier.featured ? (
                <MarketingPrimaryLink
                  href="/contact"
                  label={tier.cta}
                  variant="coral"
                  showArrow
                  fullWidth
                />
              ) : (
                <MarketingOutlineLink href="/contact" label={tier.cta} showArrow fullWidth />
              )}
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.12} className="mt-10 text-center">
          <p className="mx-auto max-w-[720px] text-[13px] text-[var(--sc-ink-muted)]">
            All plans include free data migration and no setup fee. Prices exclusive of VAT.
            Illustrative — confirm before launch.{' '}
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
