import { AboutFinalCta } from '@/components/marketing/about/AboutFinalCta';
import { MarketingFaq } from '@/components/marketing/sections/MarketingFaq';
import { MarketingHowSection } from '@/components/marketing/sections/MarketingHowSection';
import { MarketingPricingSection } from '@/components/marketing/sections/MarketingPricingSection';
import { HomeComplianceProcess } from '@/components/marketing/home/HomeComplianceProcess';
import { HomeCapabilityTicker } from '@/components/marketing/home/HomeCapabilityTicker';
import { HomeHero } from '@/components/marketing/home/HomeHero';
import { HomeScrollStatement } from '@/components/marketing/home/HomeScrollStatement';
import { HomeSolutionsTabs } from '@/components/marketing/home/HomeSolutionsTabs';
import { FAQ_ITEMS } from '@/lib/marketing-config';
import { StudioCraftIndustriesSection } from './StudioCraftIndustriesSection';
import { StudioCraftWhySection } from './StudioCraftWhySection';

export function StudioCraftHomePage() {
  return (
    <>
      <HomeHero />
      <HomeCapabilityTicker />
      <HomeSolutionsTabs />
      <HomeScrollStatement />
      <StudioCraftWhySection />
      <StudioCraftIndustriesSection />
      <HomeComplianceProcess />
      <MarketingHowSection />
      <MarketingPricingSection />
      <MarketingFaq items={FAQ_ITEMS} />
      <AboutFinalCta />
    </>
  );
}
