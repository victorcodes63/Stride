import {
  MarketingOutlineLink,
  MarketingPrimaryLink,
} from '@/components/marketing/v3/studio-craft-shared';
import { marketingTierModuleSummary } from '@/lib/marketing-pricing-entitlements';
import {
  PRICING_PLANS,
  formatKes,
  planCtaHref,
  planExampleLine,
  type PricingPlan,
} from '@/lib/pricing';

function PriceBlock({ plan }: { plan: PricingPlan }) {
  const example = planExampleLine(plan);

  if (plan.rateKesPerEmployee === null) {
    return (
      <>
        <p className="mt-6 font-heading text-[clamp(1.75rem,8vw,2.25rem)] font-extrabold text-pub-ink sm:text-4xl">
          {plan.customPriceLabel}
        </p>
        <p className="mt-1 text-sm text-pub-ink-subtle">{plan.unit}</p>
      </>
    );
  }

  return (
    <>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-pub-ink-subtle">
        from
      </p>
      <p className="font-heading text-[clamp(2rem,9vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em] text-pub-ink">
        {formatKes(plan.rateKesPerEmployee)}
      </p>
      <p className="mt-2 text-sm text-pub-ink-muted">{plan.unit}</p>
      {example ? <p className="mt-1 text-[13px] text-pub-ink-subtle">{example}</p> : null}
    </>
  );
}

export function PricingPlanCards() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {PRICING_PLANS.map((plan) => {
        const metered = plan.rateKesPerEmployee !== null;

        return (
          <article
            key={plan.id}
            className={`flex min-w-0 flex-col rounded-[20px] border bg-white p-5 text-center sm:p-8 ${
              plan.eyebrow ? 'border-[var(--pub-primary)]/35' : 'border-pub-border'
            }`}
          >
            {plan.eyebrow ? (
              <span className="mx-auto mb-3 inline-flex rounded-full bg-[var(--pub-primary)]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--pub-primary)]">
                {plan.eyebrow}
              </span>
            ) : null}
            <p className="font-heading text-sm font-bold uppercase tracking-wide text-[var(--pub-primary)]">
              {plan.name}
            </p>

            <PriceBlock plan={plan} />

            <p className="my-6 border-b border-pub-border pb-6 text-sm leading-relaxed text-pub-ink-muted">
              {plan.description}
            </p>

            <ul className="mx-auto mb-8 flex w-full max-w-[16rem] flex-1 flex-col gap-3 text-left text-sm text-pub-ink-muted sm:max-w-[18rem]">
              {marketingTierModuleSummary(plan.deploymentTier).map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-[var(--pub-primary)]">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {metered ? (
              <MarketingPrimaryLink
                href={planCtaHref(plan)}
                label={plan.ctaLabel}
                variant="coral"
                showArrow
                fullWidth
              />
            ) : (
              <MarketingOutlineLink
                href={planCtaHref(plan)}
                label={plan.ctaLabel}
                showArrow
                fullWidth
              />
            )}
          </article>
        );
      })}
    </div>
  );
}
