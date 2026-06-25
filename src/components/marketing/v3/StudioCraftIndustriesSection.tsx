'use client';

import { IndustryWireframePreview } from '@/components/marketing/mockups/IndustryWireframePreview';
import { Reveal, Stagger, StaggerItem } from '@/components/marketing/motion';
import {
  INDUSTRY_VERTICALS,
  MARKETING_CTAS,
  MARKETING_INDUSTRIES_SECTION,
  MARKETING_ROUTES,
} from '@/lib/marketing-config';
import { MarketingOutlineLink, SectionBadge, StudioCraftContainer, TextRollLink } from './studio-craft-shared';

type IndustryId = 'logistics' | 'saccos' | 'healthcare' | 'energy' | 'construction';

const HOMEPAGE_INDUSTRY_ORDER: IndustryId[] = [
  'logistics',
  'saccos',
  'healthcare',
  'energy',
  'construction',
];

function IndustryCard({
  id,
  title,
  description,
  href,
  cta,
  status,
}: {
  id: IndustryId;
  title: string;
  description: string;
  href: string;
  cta: string;
  status: 'available' | 'coming_soon';
}) {
  const isAvailable = status === 'available';
  const statusLabel = isAvailable ? 'Live' : 'Coming soon';

  return (
    <article className="group flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-xl font-medium text-[var(--sc-ink)]">{title}</h3>
        <span
          className={`font-mono text-[10px] font-medium uppercase tracking-[0.08em] ${
            isAvailable ? 'text-[var(--sc-coral)]' : 'text-[var(--sc-ink-subtle,#8A8076)]'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--sc-line)] bg-white shadow-[0_16px_40px_-20px_rgba(26,23,20,0.12)]">
        <div className="aspect-[16/10] overflow-hidden bg-[var(--sc-paper-2)] p-3 sm:p-4">
          <IndustryWireframePreview industryId={id} className="h-full" />
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--sc-ink-muted)]">{description}</p>

      <div className="mt-5 flex items-center">
        <TextRollLink
          href={href}
          label={cta}
          variant={isAvailable ? 'coral' : 'ink'}
          showArrow
        />
      </div>
    </article>
  );
}

export function StudioCraftIndustriesSection() {
  const industries = HOMEPAGE_INDUSTRY_ORDER.map((id) =>
    INDUSTRY_VERTICALS.find((vertical) => vertical.id === id),
  ).filter((vertical): vertical is (typeof INDUSTRY_VERTICALS)[number] => Boolean(vertical));

  return (
    <section className="bg-[var(--sc-paper)] py-16 sm:py-20 lg:py-28">
      <StudioCraftContainer>
        <Reveal>
          <SectionBadge number="02" label={MARKETING_INDUSTRIES_SECTION.badge} />
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="max-w-[640px] text-[clamp(2rem,4.5vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
            Then it gets <span className="text-[var(--sc-coral)]">specific.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-[var(--sc-ink-muted)] sm:text-lg">
            {MARKETING_INDUSTRIES_SECTION.subLead}
          </p>
        </Reveal>

        <Stagger
          className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8"
          delayChildren={0.14}
        >
          {industries.map((vertical) => (
            <StaggerItem key={vertical.id}>
              <IndustryCard
                id={vertical.id}
                title={vertical.name}
                description={vertical.description}
                href={vertical.href}
                cta={
                  vertical.status === 'available'
                    ? vertical.id === 'logistics'
                      ? MARKETING_CTAS.seeFleet
                      : MARKETING_CTAS.seeDemo
                    : MARKETING_CTAS.joinWaitlist
                }
                status={vertical.status}
              />
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.18} className="mt-10">
          <MarketingOutlineLink href={MARKETING_ROUTES.industries} label="All industries" showArrow />
        </Reveal>
      </StudioCraftContainer>
    </section>
  );
}
