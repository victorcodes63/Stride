import Link from 'next/link';
import { Globe } from '@phosphor-icons/react/dist/ssr';
import { Reveal } from '@/components/marketing/motion';
import { EditorialSectionHead } from '@/components/marketing/editorial/EditorialSectionHead';
import { MarketingPrimaryLink, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import {
  FREE_PARALLEL_RUN,
  INTERNATIONAL_PRICING,
  PRICING_INTENTS,
  contactHref,
  freeParallelRunSmallPrint,
  internationalPricingBody,
} from '@/lib/pricing';

/** Ink band: one full payroll cycle run free, alongside the customer's current process. */
export function PricingFreeRunBand({ index, total }: { index: string; total: number }) {
  return (
    <section
      className="sc-on-ink relative overflow-hidden bg-[var(--sc-ink)] py-24 text-white sm:py-28 lg:py-32"
      aria-labelledby="pricing-free-run-heading"
    >
      <div
        className="pointer-events-none absolute right-[-10rem] top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,84,54,0.16),transparent)]"
        aria-hidden
      />
      <StudioCraftContainer className="relative">
        <EditorialSectionHead
          tone="dark"
          id="pricing-free-run-heading"
          index={index}
          total={total}
          label="Free payroll run"
          title={
            <>
              Your first payroll run <span className="text-[var(--sc-coral)]">is on us.</span>
            </>
          }
          note={FREE_PARALLEL_RUN.description}
        />

        <ol className="mt-14 grid gap-3 lg:mt-20 lg:grid-cols-3">
          {FREE_PARALLEL_RUN.steps.map((step, index) => (
            <Reveal key={step.title} as="li" delay={Math.min(index * 0.06, 0.2)}>
              <div
                className={`flex h-full min-h-[280px] flex-col rounded-[22px] p-7 sm:p-8 ${
                  index === FREE_PARALLEL_RUN.steps.length - 1
                    ? 'bg-[var(--sc-coral)] shadow-[0_30px_70px_-36px_rgba(230,62,34,0.7)]'
                    : 'border border-white/10 bg-white/[0.04]'
                }`}
              >
                <span
                  className={`text-[clamp(3rem,5vw,4.5rem)] font-light leading-[0.85] tracking-[-0.05em] ${
                    index === FREE_PARALLEL_RUN.steps.length - 1 ? 'text-white' : 'text-white/25'
                  }`}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="mt-12 text-[22px] font-medium leading-tight tracking-[-0.02em] text-white">{step.title}</p>
                <p
                  className={`mt-3 text-[15px] leading-[1.7] ${
                    index === FREE_PARALLEL_RUN.steps.length - 1 ? 'text-white/85' : 'text-white/60'
                  }`}
                >
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.2}>
          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <MarketingPrimaryLink
              href={contactHref(PRICING_INTENTS.parallelRun)}
              label="Get a free payroll run"
              variant="coral"
              showArrow
            />
            <p className="text-[14px] text-white/50">{freeParallelRunSmallPrint()}</p>
          </div>
        </Reveal>
      </StudioCraftContainer>
    </section>
  );
}

/** Kenyan payroll for employers based outside Kenya, billed in USD. */
export function PricingInternationalBand() {
  return (
    <Reveal>
      <section
        className="flex flex-col gap-6 rounded-[22px] border border-[var(--sc-line)] bg-[var(--sc-paper-2)] p-7 sm:flex-row sm:items-center sm:gap-8 sm:p-8"
        aria-labelledby="pricing-international-heading"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white text-[var(--sc-coral)]">
          <Globe size={24} weight="duotone" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="pricing-international-heading" className="text-[22px] font-medium tracking-[-0.02em] text-[var(--sc-ink)]">
            {INTERNATIONAL_PRICING.heading}
          </h2>
          <p className="mt-2 text-[15px] leading-[1.7] text-[var(--sc-ink-muted)]">{internationalPricingBody()}</p>
        </div>
        <Link
          href={contactHref(PRICING_INTENTS.international)}
          className="group inline-flex shrink-0 items-center gap-2 text-[15px] font-semibold text-[var(--sc-ink)] transition-colors hover:text-[var(--sc-coral)]"
        >
          Talk to us about USD billing
          <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
            →
          </span>
        </Link>
      </section>
    </Reveal>
  );
}
