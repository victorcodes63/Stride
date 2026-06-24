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

  return (
    <article className="group flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-xl font-medium text-[var(--sc-ink)]">{title}</h3>
        <span
          className={`font-mono text-[10px] font-medium uppercase tracking-[0.08em] ${
            isAvailable ? 'text-[var(--sc-coral)]' : 'text-[var(--sc-ink-subtle,#8A8076)]'
          }`}
        >
          {isAvailable ? 'Available' : 'Coming soon'}
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
  const logistics = INDUSTRY_VERTICALS.find((v) => v.id === 'logistics');
  const saccos = INDUSTRY_VERTICALS.find((v) => v.id === 'saccos');

  return (
    <section className="bg-[var(--sc-paper)] py-16 sm:py-20 lg:py-28">
      <StudioCraftContainer>
        <Reveal>
          <SectionBadge number="2" label={MARKETING_INDUSTRIES_SECTION.badge} />
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="max-w-[640px] text-[clamp(2rem,4.5vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.03em] text-[var(--sc-ink)]">
            Then it gets <span className="text-[var(--sc-coral)]">specific.</span>
          </h2>
        </Reveal>

        <Stagger className="mt-10 grid gap-8 lg:grid-cols-2 lg:gap-10" delayChildren={0.12}>
          {logistics ? (
            <StaggerItem>
              <IndustryCard
                id="logistics"
                title={logistics.name}
                description={logistics.description}
                href={logistics.href}
                cta={MARKETING_CTAS.seeFleet}
                status={logistics.status}
              />
            </StaggerItem>
          ) : null}
          {saccos ? (
            <StaggerItem>
              <IndustryCard
                id="saccos"
                title={saccos.name}
                description={saccos.description}
                href={saccos.href}
                cta={MARKETING_CTAS.joinWaitlist}
                status={saccos.status}
              />
            </StaggerItem>
          ) : null}
        </Stagger>

        <Reveal delay={0.16} className="mt-10">
          <MarketingOutlineLink href={MARKETING_ROUTES.industries} label="All industries" showArrow />
        </Reveal>
      </StudioCraftContainer>
    </section>
  );
}
