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

/**
 * Each card spans five rows (lg:row-span-5) of the parent grid and shares them via subgrid on lg+,
 * so plan name, price, description, feature list and CTA line up across all three
 * cards regardless of copy length. Below lg the cards stack and flow naturally.
 */
function PriceBlock({ plan }: { plan: PricingPlan }) {
  const example = planExampleLine(plan);
  const metered = plan.rateKesPerEmployee !== null;

  return (
    <div className="flex flex-col items-center">
      {/* Keep the "from" line on every card so the big figures share a baseline. */}
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.12em] text-pub-ink-subtle ${
          metered ? '' : 'invisible'
        }`}
        aria-hidden={!metered}
      >
        from
      </p>
      <p className="mt-1 font-heading text-[clamp(2rem,9vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em] text-pub-ink">
        {metered ? formatKes(plan.rateKesPerEmployee!) : plan.customPriceLabel}
      </p>
      <p className="mt-3 text-sm text-pub-ink-muted">{plan.unit}</p>
      <p className="mt-1 text-[13px] text-pub-ink-subtle">
        {example ?? 'Quoted on your order form'}
      </p>
    </div>
  );
}

export function PricingPlanCards() {
  return (
    <div className="grid gap-5 pt-3 lg:grid-cols-3 lg:gap-x-5 lg:gap-y-0">
      {PRICING_PLANS.map((plan) => {
        const metered = plan.rateKesPerEmployee !== null;
        const featured = Boolean(plan.eyebrow);

        return (
          <article
            key={plan.id}
            className={`relative flex min-w-0 flex-col gap-6 rounded-[20px] border p-6 text-center sm:p-8 lg:row-span-5 lg:grid lg:grid-rows-subgrid lg:gap-6 ${
              featured
                ? 'border-[var(--pub-primary)]/45 bg-white shadow-[0_18px_40px_-24px_rgba(26,23,20,0.35)]'
                : 'border-pub-border bg-white'
            }`}
          >
            {featured ? (
              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[var(--pub-primary)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
                {plan.eyebrow}
              </span>
            ) : null}

            {/* Row 1 — plan name */}
            <p className="font-heading text-sm font-bold uppercase tracking-wide text-[var(--pub-primary)]">
              {plan.name}
            </p>

            {/* Row 2 — price */}
            <PriceBlock plan={plan} />

            {/* Row 3 — description, ruled off from the features */}
            <p className="border-b border-pub-border pb-6 text-sm leading-relaxed text-pub-ink-muted">
              {plan.description}
            </p>

            {/* Row 4 — features (stretches so CTAs align) */}
            <ul className="mx-auto flex w-full max-w-[19rem] flex-col gap-3 text-left text-sm text-pub-ink-muted">
              {marketingTierModuleSummary(plan.deploymentTier).map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0 text-[var(--pub-primary)]" aria-hidden>
                    ✓
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Row 5 — CTA */}
            <div className="self-end">
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
            </div>
          </article>
        );
      })}
    </div>
  );
}
