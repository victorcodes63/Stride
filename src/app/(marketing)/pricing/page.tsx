import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { EditorialTextLink } from '@/components/marketing/editorial/EditorialParts';
import { EditorialPageHero } from '@/components/marketing/editorial/EditorialPageHero';
import { EditorialSectionHead } from '@/components/marketing/editorial/EditorialSectionHead';
import { PricingCalculator } from '@/components/marketing/pricing/PricingCalculator';
import { PricingCompareMatrix } from '@/components/marketing/pricing/PricingCompareMatrix';
import { PricingFreeRunBand, PricingInternationalBand } from '@/components/marketing/pricing/PricingOfferBands';
import { PricingPlanCards } from '@/components/marketing/pricing/PricingPlanCards';
import { MarketingFaq } from '@/components/marketing/sections/MarketingFaq';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MarketingPrimaryLink, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { softwareApplicationJsonLd } from '@/lib/marketing-schema';
import {
  PRICING_FAQ,
  PRICING_FOOTNOTE,
  PRICING_INTENTS,
  contactHref,
  formatKes,
  getPricingPlan,
} from '@/lib/pricing';

const essentialsRate = getPricingPlan('essentials').rateKesPerEmployee ?? 0;

/** Indexed sections on this page, for the "02 / 04" counters. */
const TOTAL = 4;

export const metadata = marketingMetadata({
  title: 'Pricing',
  description: `Per-employee pricing for HRIS, HRMS, payroll and finance in Kenya, from ${formatKes(essentialsRate)} per employee per month. Your first payroll run is free.`,
  path: '/pricing',
  keywords: ['Stride pricing', 'HRIS Kenya pricing', 'payroll software Kenya cost'],
});

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={softwareApplicationJsonLd(
          `Per-employee HRIS, HRMS, payroll and finance pricing in Kenya from ${formatKes(essentialsRate)} per employee.`,
        )}
      />
      <EditorialPageHero
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Pricing', path: '/pricing' },
        ]}
        badge="Pricing"
        title={
          <>
            Pay per employee. <span className="text-[var(--sc-coral)]">Start with a free payroll run.</span>
          </>
        }
        description="HR, payroll and finance on one platform, priced by headcount in Kenyan shillings. We run your first payroll free, alongside your current process, so you can check every figure before you pay."
        actions={
          <>
            <MarketingPrimaryLink
              href={contactHref(PRICING_INTENTS.parallelRun)}
              label="Get a free payroll run"
              variant="coral"
              showArrow
            />
            <EditorialTextLink href={contactHref()} label="Book a demo" />
          </>
        }
      />

      {/* 01 · Plans */}
      <section className="border-t border-[var(--sc-line)] bg-white py-24 sm:py-28 lg:py-32" aria-labelledby="pricing-plans-heading">
        <StudioCraftContainer>
          <EditorialSectionHead
            id="pricing-plans-heading"
            index="01"
            total={TOTAL}
            label="Plans"
            title={
              <>
                One price per person. <span className="text-[var(--sc-coral)]">No minimums.</span>
              </>
            }
            note={PRICING_FOOTNOTE}
          />
          <div className="mt-14 lg:mt-20">
            <PricingPlanCards />
          </div>
        </StudioCraftContainer>
      </section>

      {/* 02 · Calculator */}
      <section className="bg-[var(--sc-paper-2)] py-24 sm:py-28 lg:py-32" aria-labelledby="pricing-calculator-section-heading">
        <StudioCraftContainer>
          <EditorialSectionHead
            id="pricing-calculator-section-heading"
            index="02"
            total={TOTAL}
            label="Calculator"
            title={
              <>
                What will it <span className="text-[var(--sc-coral)]">cost us?</span>
              </>
            }
            note="Move the slider to your headcount. There is no minimum and no band to fall into."
          />
          <div className="mt-14 lg:mt-20">
            <PricingCalculator showHeader={false} />
          </div>
          <div className="mt-3">
            <PricingInternationalBand />
          </div>
        </StudioCraftContainer>
      </section>

      {/* 03 · Free payroll run */}
      <PricingFreeRunBand index="03" total={TOTAL} />

      {/* 04 · Compare */}
      <section className="bg-white py-24 sm:py-28 lg:py-32" aria-labelledby="pricing-compare-section-heading">
        <StudioCraftContainer>
          <EditorialSectionHead
            id="pricing-compare-section-heading"
            index="04"
            total={TOTAL}
            label="Compare plans"
            title={
              <>
                Exactly what <span className="text-[var(--sc-coral)]">each plan unlocks.</span>
              </>
            }
            note="Horizontal and vertical modules show as add-ons on Essentials where that is honest. Plans differ by features, never by team size."
          />
          <div className="mt-10 lg:mt-14">
            <PricingCompareMatrix showHeader={false} />
          </div>
        </StudioCraftContainer>
      </section>

      <MarketingFaq items={PRICING_FAQ} />

      <MarketingCtaBand
        title="See Stride run your actual payroll."
        description="Send us your headcount and current setup. We'll do the rest."
        primary={{ href: contactHref(PRICING_INTENTS.parallelRun), label: 'Get a free payroll run' }}
        secondary={{ href: contactHref(), label: 'Book a demo' }}
      />
    </>
  );
}
