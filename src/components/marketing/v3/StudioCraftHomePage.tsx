import { AboutFinalCta } from '@/components/marketing/about/AboutFinalCta';
import { MarketingFaq } from '@/components/marketing/sections/MarketingFaq';
import { MarketingHowSection } from '@/components/marketing/sections/MarketingHowSection';
import { MarketingPricingSection } from '@/components/marketing/sections/MarketingPricingSection';
import { HomeComplianceBand } from '@/components/marketing/home/HomeComplianceBand';
import { HomeHero } from '@/components/marketing/home/HomeHero';
import { HomeSolutionsTabs } from '@/components/marketing/home/HomeSolutionsTabs';
import { FAQ_ITEMS } from '@/lib/marketing-config';
import { StudioCraftIndustriesSection } from './StudioCraftIndustriesSection';
import { StudioCraftWhySection } from './StudioCraftWhySection';

export function StudioCraftHomePage() {
  return (
    <>
      <HomeHero />
      <HomeSolutionsTabs />
      <StudioCraftWhySection />
      <StudioCraftIndustriesSection />
      <HomeComplianceBand />
      <MarketingHowSection />
      <MarketingPricingSection />
      <MarketingFaq items={FAQ_ITEMS} />
      <AboutFinalCta />
    </>
  );
}
