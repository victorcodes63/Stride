import {
  MarketingPageHero,
  MarketingPageHeroDescription,
  MarketingPageHeroEyebrow,
  MarketingPageHeroTitle,
} from '@/components/marketing/MarketingPageHero';
import { INDUSTRIES_HERO } from './industries-content';

export function IndustriesPageHeader() {
  return (
    <MarketingPageHero>
      <MarketingPageHeroEyebrow className="mb-5">{INDUSTRIES_HERO.eyebrow}</MarketingPageHeroEyebrow>
      <MarketingPageHeroTitle className="max-w-2xl">{INDUSTRIES_HERO.title}</MarketingPageHeroTitle>
      <MarketingPageHeroDescription className="mt-4 max-w-xl sm:mt-5">
        {INDUSTRIES_HERO.subhead}
      </MarketingPageHeroDescription>
    </MarketingPageHero>
  );
}
