import Link from 'next/link';
import { MarketingPrimaryLink } from '@/components/marketing/v3/studio-craft-shared';
import {
  FREE_PARALLEL_RUN,
  INTERNATIONAL_PRICING,
  PRICING_INTENTS,
  contactHref,
  freeParallelRunSmallPrint,
  internationalPricingBody,
} from '@/lib/pricing';

/** Ink band: one full payroll cycle run free, alongside the customer's current process. */
export function PricingFreeRunBand() {
  return (
    <section
      className="pub-on-ink bg-pub-ink px-5 py-12 text-[#FBF8F4] sm:px-8 sm:py-16 lg:px-12 lg:py-20"
      aria-labelledby="pricing-free-run-heading"
    >
      <div className="mx-auto min-w-0 max-w-[1100px]">
        <div className="max-w-[40rem]">
          <h2
            id="pricing-free-run-heading"
            className="font-heading text-[clamp(1.5rem,6vw,2.5rem)] font-extrabold tracking-[-0.03em]"
          >
            {FREE_PARALLEL_RUN.heading}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#C9C0B6] sm:mt-4 sm:text-[15px]">
            {FREE_PARALLEL_RUN.description}
          </p>
        </div>

        <ol className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-3 sm:gap-5">
          {FREE_PARALLEL_RUN.steps.map((step, index) => (
            <li
              key={step.title}
              className="min-w-0 rounded-[16px] border border-white/10 bg-white/[0.04] p-5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pub-primary)]/20 text-sm font-semibold text-[var(--pub-primary)]">
                {index + 1}
              </span>
              <p className="mt-4 font-heading text-base font-bold text-[#FBF8F4]">{step.title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#C9C0B6]">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="marketing-cta-stack mt-8 flex flex-col items-start gap-4 sm:mt-10 sm:flex-row sm:items-center">
          <MarketingPrimaryLink
            href={contactHref(PRICING_INTENTS.parallelRun)}
            label="Get a free payroll run"
            variant="coral"
          />
          <p className="text-[13px] text-[#9C948A]">{freeParallelRunSmallPrint()}</p>
        </div>
      </div>
    </section>
  );
}

/** Kenyan payroll for employers based outside Kenya, billed in USD. */
export function PricingInternationalBand() {
  return (
    <section
      className="rounded-[20px] border border-pub-border bg-pub-surface-muted p-5 sm:p-7"
      aria-labelledby="pricing-international-heading"
    >
      <div className="max-w-[48rem]">
        <h2
          id="pricing-international-heading"
          className="font-heading text-base font-bold text-pub-ink sm:text-lg"
        >
          {INTERNATIONAL_PRICING.heading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-pub-ink-muted">
          {internationalPricingBody()}{' '}
          <Link
            href={contactHref(PRICING_INTENTS.international)}
            className="font-semibold text-[var(--pub-primary)] underline-offset-4 hover:underline"
          >
            Talk to us about international billing
          </Link>
        </p>
      </div>
    </section>
  );
}
