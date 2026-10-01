'use client';

import Link from 'next/link';
import { marketingTierModuleSummary } from '@/lib/marketing-pricing-entitlements';
import {
  PRICING_FOOTNOTE,
  PRICING_PLANS,
  formatKes,
  planCtaHref,
  planExampleLine,
  type PricingPlan,
} from '@/lib/pricing';
import { Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import {
  MarketingOutlineLink,
  MarketingPrimaryLink,
  SectionBadge,
  StudioCraftContainer,
} from '@/components/marketing/v3/studio-craft-shared';

function PlanPrice({ plan }: { plan: PricingPlan }) {
  const example = planExampleLine(plan);

  if (plan.rateKesPerEmployee === null) {
    return (
      <>
        <p className="mt-3 text-[2rem] font-medium leading-none tracking-[-0.03em] text-[var(--sc-ink)] sm:mt-4 sm:text-[2.5rem]">
          {plan.customPriceLabel}
        </p>
        <p className="mt-2 text-[13px] text-[var(--sc-ink-muted)]">{plan.unit}</p>
      </>
    );
  }

  return (
    <>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--sc-ink-subtle)]">
        from
      </p>
      <p className="text-[2rem] font-medium leading-none tracking-[-0.03em] text-[var(--sc-ink)] sm:text-[2.5rem]">
        {formatKes(plan.rateKesPerEmployee)}
      </p>
      <p className="mt-2 text-[13px] text-[var(--sc-ink-muted)]">{plan.unit}</p>
      {example ? (
        <p className="mt-1 text-[13px] text-[var(--sc-ink-subtle)]">{example}</p>
      ) : null}
    </>
  );
}

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

        <Stagger
          className="mt-10 grid gap-4 sm:mt-12 sm:gap-5 lg:mt-14 lg:grid-cols-3 lg:gap-6"
          delayChildren={0.14}
        >
          {PRICING_PLANS.map((plan) => (
            <StaggerItem
              key={plan.id}
              as="article"
              className={`relative marketing-hover-lift flex h-full min-w-0 flex-col rounded-[20px] border bg-white p-5 text-center transition hover:shadow-[0_16px_44px_rgba(26,23,20,0.09)] sm:p-8 lg:p-9 ${
                plan.eyebrow ? 'border-[var(--sc-coral)]/35' : 'border-[var(--sc-line)]'
              }`}
            >
              {plan.eyebrow ? (
                <span className="mx-auto mb-3 inline-flex rounded-full bg-[var(--sc-coral)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--sc-coral)] sm:text-[11px]">
                  {plan.eyebrow}
                </span>
              ) : null}
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--sc-coral)]">
                {plan.name}
              </p>

              <PlanPrice plan={plan} />

              <p className="my-6 border-b border-[var(--sc-line)] pb-6 text-sm leading-relaxed text-[var(--sc-ink-muted)]">
                {plan.description}
              </p>
              <ul className="mx-auto mb-8 flex w-full max-w-[16rem] flex-1 flex-col gap-2.5 text-left text-sm text-[var(--sc-ink-muted)] sm:max-w-[18rem]">
                {marketingTierModuleSummary(plan.deploymentTier).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 leading-snug">
                    <span className="mt-0.5 shrink-0 text-[var(--sc-coral)]">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {plan.rateKesPerEmployee === null ? (
                <MarketingOutlineLink
                  href={planCtaHref(plan)}
                  label={plan.ctaLabel}
                  showArrow
                  fullWidth
                />
              ) : (
                <MarketingPrimaryLink
                  href={planCtaHref(plan)}
                  label={plan.ctaLabel}
                  variant="coral"
                  showArrow
                  fullWidth
                />
              )}
            </StaggerItem>
          ))}
        </Stagger>

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
