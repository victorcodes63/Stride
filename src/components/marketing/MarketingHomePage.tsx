import { MarketingCoreSection } from '@/components/marketing/sections/MarketingCoreSection';
import { MarketingFeatureSplit } from '@/components/marketing/sections/MarketingFeatureSplit';
import { MarketingFinalCta } from '@/components/marketing/sections/MarketingFinalCta';
import { MarketingHero } from '@/components/marketing/sections/MarketingHero';
import { MarketingHowSection } from '@/components/marketing/sections/MarketingHowSection';
import { MarketingIndustriesBento } from '@/components/marketing/sections/MarketingIndustriesBento';
import { MarketingPricingSection } from '@/components/marketing/sections/MarketingPricingSection';
import { MarketingTrustStrip } from '@/components/marketing/sections/MarketingTrustStrip';
import { MarketingWhySection } from '@/components/marketing/sections/MarketingWhySection';
import { MarketingFaq } from '@/components/marketing/sections/MarketingFaq';
import { FAQ_ITEMS } from '@/lib/marketing-config';

export function MarketingHomePage() {
  return (
    <>
      <MarketingHero />
      <MarketingTrustStrip />
      <MarketingCoreSection />
      <MarketingFeatureSplit />
      <MarketingIndustriesBento />
      <MarketingWhySection />
      <MarketingHowSection />
      <MarketingPricingSection />
      <MarketingFaq items={FAQ_ITEMS} />
      <MarketingFinalCta />
    </>
  );
}
