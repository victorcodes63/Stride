import { marketingMetadata } from '@/lib/marketing-metadata';
import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { MarketingPageBody } from '@/components/marketing/MarketingPageBody';
import { MarketingPageHeader } from '@/components/marketing/MarketingPageHeader';
import { PricingCalculator } from '@/components/marketing/pricing/PricingCalculator';
import { PricingCompareMatrix } from '@/components/marketing/pricing/PricingCompareMatrix';
import { PricingFaq } from '@/components/marketing/pricing/PricingFaq';
import {
  PricingFreeRunBand,
  PricingInternationalBand,
} from '@/components/marketing/pricing/PricingOfferBands';
import { PricingPlanCards } from '@/components/marketing/pricing/PricingPlanCards';
import {
  MarketingOutlineLink,
  MarketingPrimaryLink,
} from '@/components/marketing/v3/studio-craft-shared';
import {
  PRICING_FOOTNOTE,
  PRICING_INTENTS,
  contactHref,
  formatKes,
  getPricingPlan,
} from '@/lib/pricing';

const essentialsRate = getPricingPlan('essentials').rateKesPerEmployee ?? 0;

export const metadata = marketingMetadata({
  title: 'Pricing — Stride',
  description: `Per-employee pricing for HR, payroll and finance in Kenya, from ${formatKes(essentialsRate)} per employee per month. Your first payroll run is free.`,
  path: '/pricing',
});

export default function PricingPage() {
  return (
    <>
      <MarketingPageHeader
        breadcrumb={[{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }]}
        eyebrow="Pricing"
        title="Pay per employee. Start with a free payroll run."
        description="HR, payroll and finance on one platform, priced by headcount in Kenyan shillings. We run your first payroll free, alongside your current process, so you can check every figure before you pay."
        align="center"
      />

      <MarketingPageBody>
        <div className="marketing-cta-stack mb-10 flex flex-col gap-3 sm:mb-12 sm:flex-row sm:justify-center">
          <MarketingPrimaryLink
            href={contactHref(PRICING_INTENTS.parallelRun)}
            label="Get a free payroll run"
            variant="coral"
          />
          <MarketingOutlineLink href={contactHref()} label="Book a demo" />
        </div>

        <PricingPlanCards />

        <p className="mx-auto mt-10 max-w-[44rem] text-center text-sm text-pub-ink-subtle">
          {PRICING_FOOTNOTE}
        </p>

        <PricingCalculator />
      </MarketingPageBody>

      <PricingFreeRunBand />

      <MarketingPageBody className="pt-12 sm:pt-16">
        <PricingInternationalBand />

        <PricingCompareMatrix />

        <PricingFaq />
      </MarketingPageBody>

      <MarketingCtaBand
        title="See Stride run your actual payroll."
        description="Send us your headcount and current setup. We'll do the rest."
        primary={{ href: contactHref(PRICING_INTENTS.parallelRun), label: 'Get a free payroll run' }}
        variant="coral"
      />
    </>
  );
}
