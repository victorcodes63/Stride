import { AboutFinalCta } from './AboutFinalCta';
import { AboutHero } from './AboutHero';
import {
  AboutOriginSection,
  AboutPrinciplesSection,
  AboutStatsBand,
  AboutTrustSection,
} from './AboutSections';

export function AboutPageContent() {
  return (
    <>
      <AboutHero />
      <AboutOriginSection />
      <AboutPrinciplesSection />
      <AboutTrustSection />
      <AboutStatsBand />
      <AboutFinalCta />
    </>
  );
}
