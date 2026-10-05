import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { EditorialTextLink } from '@/components/marketing/editorial/EditorialParts';
import { EditorialPageHero } from '@/components/marketing/editorial/EditorialPageHero';
import { MarketingPrimaryLink } from '@/components/marketing/v3/studio-craft-shared';
import { MARKETING_CTAS, MARKETING_ROUTES } from '@/lib/marketing-config';
import { INDUSTRIES_CLOSING_CTA, INDUSTRIES_HERO } from './industries-content';
import {
  IndustriesComparison,
  IndustriesCoreBand,
  IndustriesDeepDives,
  IndustriesSectorIndex,
} from './IndustriesEditorial';

export function IndustriesPageContent() {
  return (
    <>
      <EditorialPageHero
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Industries', path: '/industries' },
        ]}
        badge={INDUSTRIES_HERO.eyebrow}
        title={
          <>
            Built for your <span className="text-[var(--sc-coral)]">industry.</span>
          </>
        }
        description={INDUSTRIES_HERO.subhead}
        actions={
          <>
            <MarketingPrimaryLink href={MARKETING_ROUTES.contact} label={MARKETING_CTAS.bookDemo} variant="coral" showArrow />
            <EditorialTextLink href="/platform" label="Explore the platform" />
          </>
        }
      />
      <IndustriesSectorIndex />
      <IndustriesDeepDives />
      <IndustriesCoreBand />
      <IndustriesComparison />
      <MarketingCtaBand
        title={INDUSTRIES_CLOSING_CTA.title}
        description={INDUSTRIES_CLOSING_CTA.description}
        primary={INDUSTRIES_CLOSING_CTA.primary}
        secondary={INDUSTRIES_CLOSING_CTA.secondary}
      />
    </>
  );
}
