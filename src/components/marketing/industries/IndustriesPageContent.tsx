import { CoreVerticalPacks } from './CoreVerticalPacks';
import { IndustryDeepDiveSection } from './IndustryDeepDiveSection';
import { CoreCapabilitiesBand, StrideVsAlternativeStrip } from './IndustriesBands';
import { INDUSTRIES_CLOSING_CTA, INDUSTRY_DEEP_DIVES } from './industries-content';
import { IndustriesClosingCta } from './IndustriesClosingCta';
import { IndustriesPageHeader } from './IndustriesPageHeader';

export function IndustriesPageContent() {
  return (
    <>
      <IndustriesPageHeader />
      <CoreVerticalPacks />
      {INDUSTRY_DEEP_DIVES.map((industry, index) => (
        <IndustryDeepDiveSection key={industry.id} industry={industry} index={index} />
      ))}
      <CoreCapabilitiesBand />
      <StrideVsAlternativeStrip />
      <IndustriesClosingCta {...INDUSTRIES_CLOSING_CTA} />
    </>
  );
}
