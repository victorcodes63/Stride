'use client';

import { MagneticButton } from '@/components/marketing/motion';
import {
  MarketingOutlineLink,
} from '@/components/marketing/v3/studio-craft-shared';

type IndustriesClosingCtaProps = {
  title: string;
  description: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
};

export function IndustriesClosingCta({
  title,
  description,
  primary,
  secondary,
}: IndustriesClosingCtaProps) {
  return (
    <section className="bg-[var(--sc-coral)] px-5 py-14 text-white sm:px-8 sm:py-16 lg:px-12 lg:py-20">
      <div className="mx-auto max-w-[720px] min-w-0 text-center">
        <h2 className="font-heading text-[clamp(1.5rem,6vw,2.5rem)] font-extrabold tracking-[-0.03em] text-white">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/90 sm:mt-4 sm:text-[15px]">
          {description}
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
          <MagneticButton>
            <MarketingOutlineLink
              href={primary.href}
              label={primary.label}
              showArrow
              className="border-white/30 bg-white text-[var(--sc-coral)] hover:border-white hover:bg-white"
            />
          </MagneticButton>
          <MarketingOutlineLink
            href={secondary.href}
            label={secondary.label}
            tone="dark"
            className="border-white/40 text-white hover:border-white hover:bg-white/10"
          />
        </div>
      </div>
    </section>
  );
}
