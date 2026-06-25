import { AboutFinalCta } from '@/components/marketing/about/AboutFinalCta';
import { MarketingFaq } from '@/components/marketing/sections/MarketingFaq';
import { MarketingHowSection } from '@/components/marketing/sections/MarketingHowSection';
import { MarketingPricingSection } from '@/components/marketing/sections/MarketingPricingSection';
import { HomeComplianceBand } from '@/components/marketing/home/HomeComplianceBand';
import { HomeConnectedSection } from '@/components/marketing/home/HomeConnectedSection';
import { StudioCraftHero } from './StudioCraftHero';
import { StudioCraftIndustriesSection } from './StudioCraftIndustriesSection';
import { StudioCraftWhySection } from './StudioCraftWhySection';

export function StudioCraftHomePage() {
  return (
    <>
      <StudioCraftHero />
      <StudioCraftWhySection />
      <StudioCraftIndustriesSection />
      <HomeConnectedSection />
      <HomeComplianceBand />
      <MarketingHowSection />
      <MarketingPricingSection />
      <MarketingFaq items={FAQ_ITEMS} />
      <AboutFinalCta />
    </>
  );
}
