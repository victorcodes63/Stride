'use client';

import type { ReactNode } from 'react';
import {
  MarketingOutlineLink,
  MarketingPrimaryLink,
} from '@/components/marketing/v3/studio-craft-shared';

type CtaLink = { href: string; label: string };

type MarketingCtaBandProps = {
  title: ReactNode;
  description?: string;
  primary: CtaLink;
  secondary?: CtaLink;
  variant?: 'ink' | 'coral';
  className?: string;
};

export function MarketingCtaBand({
  title,
  description,
  primary,
  secondary,
  variant = 'ink',
  className = '',
}: MarketingCtaBandProps) {
  const onInk = variant === 'ink';

  return (
    <section
      className={`px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20 ${
        onInk ? 'pub-on-ink bg-pub-ink text-[#FBF8F4]' : 'bg-[var(--pub-primary)] text-white'
      } ${className}`.trim()}
    >
      <div className="mx-auto max-w-[720px] min-w-0 text-center">
        <h2 className="font-heading text-[clamp(1.5rem,6vw,2.5rem)] font-extrabold tracking-[-0.03em] text-inherit sm:tracking-[-1px]">
          {title}
        </h2>
        {description ? (
          <p
            className={`mt-3 text-sm leading-relaxed sm:mt-4 sm:text-[15px] ${
              onInk ? 'text-[#C9C0B6]' : 'text-white/90'
            }`}
          >
            {description}
          </p>
        ) : null}
        <div className="marketing-cta-stack mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-center">
          {onInk ? (
            <>
              <MarketingPrimaryLink href={primary.href} label={primary.label} variant="coral" />
              {secondary ? (
                <MarketingOutlineLink href={secondary.href} label={secondary.label} tone="dark" />
              ) : null}
            </>
          ) : (
            <>
              <MarketingOutlineLink
                href={primary.href}
                label={primary.label}
                className="border-white/30 bg-white text-[var(--sc-coral)] hover:border-white hover:bg-white"
              />
              {secondary ? (
                <MarketingOutlineLink
                  href={secondary.href}
                  label={secondary.label}
                  tone="dark"
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
