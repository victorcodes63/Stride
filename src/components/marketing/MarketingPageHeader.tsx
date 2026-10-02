import type { ReactNode } from 'react';
import { JsonLd } from '@/components/marketing/JsonLd';
import { breadcrumbJsonLd, type Breadcrumb } from '@/lib/marketing-schema';
import {
  MarketingPageHero,
  MarketingPageHeroDescription,
  MarketingPageHeroEyebrow,
  MarketingPageHeroTitle,
} from '@/components/marketing/MarketingPageHero';

type MarketingPageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
  visual?: ReactNode;
  /** When set, emits BreadcrumbList JSON-LD (no visual change). */
  breadcrumb?: readonly Breadcrumb[];
};

export function MarketingPageHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  className = '',
  visual,
  breadcrumb,
}: MarketingPageHeaderProps) {
  const centered = align === 'center';

  return (
    <MarketingPageHero className={className}>
      {breadcrumb && breadcrumb.length > 0 ? (
        <JsonLd data={breadcrumbJsonLd(breadcrumb)} />
      ) : null}
      <div className={centered ? 'text-center' : ''}>
        <div className={centered ? 'mb-5 flex justify-center' : 'mb-5'}>
          <MarketingPageHeroEyebrow>{eyebrow}</MarketingPageHeroEyebrow>
        </div>
        <MarketingPageHeroTitle className={centered ? 'mx-auto max-w-3xl' : 'max-w-3xl'}>
          {title}
        </MarketingPageHeroTitle>
        {description ? (
          <MarketingPageHeroDescription
            className={`mt-5 sm:mt-6 ${centered ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}
          >
            {description}
          </MarketingPageHeroDescription>
        ) : null}
        {visual ? (
          <div
            className={`mt-8 min-w-0 max-w-full overflow-hidden sm:mt-14 ${centered ? 'mx-auto max-w-4xl' : 'max-w-4xl'}`}
          >
            {visual}
          </div>
        ) : null}
      </div>
    </MarketingPageHero>
  );
}
