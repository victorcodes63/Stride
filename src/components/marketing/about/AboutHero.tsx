'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { DashboardMockup } from '@/components/marketing/mockups/DashboardMockup';
import { MOTION_EASE, MOTION_SPRING_SNAPPY, Stagger, StaggerItem } from '@/components/marketing/motion';
import {
  MarketingOutlineLink,
  TextRollLink,
} from '@/components/marketing/v3/studio-craft-shared';
import {
  MarketingPageHero,
  MarketingPageHeroDescription,
  MarketingPageHeroEyebrow,
  MarketingPageHeroTitle,
} from '@/components/marketing/MarketingPageHero';
import {
  ABOUT_PAGE,
  MARKETING_CTAS,
  MARKETING_ROUTES,
  RAVEN_TECH_URL,
} from '@/lib/marketing-config';

function HeroBlock({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOTION_SPRING_SNAPPY, delay }}
    >
      {children}
    </motion.div>
  );
}

export function AboutHero() {
  const { hero } = ABOUT_PAGE;
  const reduceMotion = useReducedMotion();

  return (
    <MarketingPageHero
      className="overflow-hidden"
      containerClassName="relative"
      decorations={
        <div
          className="pointer-events-none absolute -right-[15%] top-[-8%] h-[420px] w-[560px] opacity-[0.3]"
          aria-hidden
        >
          <motion.div
            className="h-full w-full rounded-full"
            style={{
              background:
                'radial-gradient(ellipse 60% 55% at 50% 50%, rgba(255,84,54,0.4) 0%, transparent 70%)',
              filter: 'blur(48px)',
            }}
            animate={reduceMotion ? undefined : { x: [0, -20, 12, 0], y: [0, 14, -8, 0] }}
            transition={
              reduceMotion ? undefined : { duration: 20, repeat: Infinity, ease: 'easeInOut' }
            }
          />
        </div>
      }
    >
      <div className="grid min-w-0 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="min-w-0">
          <HeroBlock delay={0.06}>
            <MarketingPageHeroEyebrow className="mb-5">{hero.eyebrow}</MarketingPageHeroEyebrow>
          </HeroBlock>

          <HeroBlock delay={0.14}>
            <MarketingPageHeroTitle>
              <span className="block">{hero.titleLines[0]}</span>
              <span className="block text-[var(--sc-coral)]">{hero.titleLines[1]}</span>
            </MarketingPageHeroTitle>
          </HeroBlock>

          <HeroBlock delay={0.22}>
            <MarketingPageHeroDescription className="mt-6">{hero.description}</MarketingPageHeroDescription>
          </HeroBlock>

            <Stagger className="mt-8 space-y-3" delayChildren={0.28}>
              {hero.highlights.map((item) => (
                <StaggerItem
                  key={item}
                  className="flex items-start gap-3 text-sm leading-relaxed text-[var(--sc-ink-muted)]"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sc-coral)]" aria-hidden />
                  {item}
                </StaggerItem>
              ))}
            </Stagger>

            <HeroBlock delay={0.38} className="marketing-cta-stack mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap">
              <TextRollLink href={MARKETING_ROUTES.contact} label={MARKETING_CTAS.bookDemo} variant="coral" />
              <MarketingOutlineLink href={MARKETING_ROUTES.platform} label={MARKETING_CTAS.explorePlatform} />
            </HeroBlock>

            <HeroBlock delay={0.46}>
              <p className="mt-6 text-[12px] leading-relaxed text-[var(--sc-ink-muted)] sm:mt-8 sm:text-[13px]">
                A{' '}
                <a
                  href={RAVEN_TECH_URL}
                  className="font-medium text-[var(--sc-coral)] hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Raven Tech Group
                </a>{' '}
                product.
              </p>
            </HeroBlock>
          </div>

          <motion.div
            className="min-w-0 overflow-hidden rounded-2xl border border-[var(--sc-line)] shadow-[0_24px_60px_rgba(26,23,20,0.08)]"
            initial={reduceMotion ? false : { opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, ease: MOTION_EASE, delay: 0.32 }}
          >
            <DashboardMockup className="w-full" />
          </motion.div>
        </div>
    </MarketingPageHero>
  );
}
