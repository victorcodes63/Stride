import type { ReactNode } from 'react';
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
};

export function MarketingPageHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  className = '',
  visual,
}: MarketingPageHeaderProps) {
  const centered = align === 'center';

  return (
    <MarketingPageHero className={className}>
      <div className={centered ? 'text-center' : ''}>
        <div className={centered ? 'mb-5 flex justify-center' : 'mb-5'}>
          <MarketingPageHeroEyebrow>{eyebrow}</MarketingPageHeroEyebrow>
        </div>
        <MarketingPageHeroTitle className={centered ? 'mx-auto max-w-3xl' : 'max-w-3xl'}>
          {title}
        </MarketingPageHeroTitle>
        {description ? (
          <MarketingPageHeroDescription
            className={`mt-4 sm:mt-5 ${centered ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}
          >
            {description}
          </MarketingPageHeroDescription>
        ) : null}
        {visual ? (
          <div
            className={`mt-8 min-w-0 max-w-full overflow-hidden sm:mt-12 ${centered ? 'mx-auto max-w-4xl' : 'max-w-4xl'}`}
          >
            {visual}
          </div>
        ) : null}
      </div>
    </MarketingPageHero>
  );
}
