import Link from 'next/link';
import type { ReactNode } from 'react';
import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { Reveal } from '@/components/marketing/motion';
import { EditorialPageHero } from '@/components/marketing/editorial/EditorialPageHero';
import { EditorialSectionHead } from '@/components/marketing/editorial/EditorialSectionHead';
import { EDITORIAL_CARD, EditorialShowcasePanel, EditorialTextLink } from '@/components/marketing/editorial/EditorialParts';
import { MarketingFaq } from '@/components/marketing/sections/MarketingFaq';
import { MarketingPrimaryLink, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { INDUSTRY_VERTICALS, MARKETING_CTAS, MARKETING_ROUTES } from '@/lib/marketing-config';

type SectorFeature = { title: string; body: string };
type SectorFaq = { q: string; a: string };

type IndustrySectorPageProps = {
  /** Matches INDUSTRY_VERTICALS[].id, used to mark the current pack in "Other packs". */
  sectorId: string;
  /** Short sector name for the breadcrumb and badges, e.g. "Logistics". */
  name: string;
  path: string;
  title: ReactNode;
  description: string;
  visual: ReactNode;
  features: readonly SectorFeature[];
  faq?: readonly SectorFaq[];
  cta: { title: string; description: string };
};

/** Shared layout for every /industries/<sector> page. */
export function IndustrySectorPage({
  sectorId,
  name,
  path,
  title,
  description,
  visual,
  features,
  faq,
  cta,
}: IndustrySectorPageProps) {
  const current = INDUSTRY_VERTICALS.find((v) => v.id === sectorId);
  const others = INDUSTRY_VERTICALS.filter((v) => v.id !== sectorId && v.status === 'available');
  const total = faq && faq.length > 0 ? 3 : 2;

  return (
    <>
      <EditorialPageHero
        size="page"
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: 'Industries', path: '/industries' },
          { name, path },
        ]}
        badge={`Industry pack · ${name}`}
        title={title}
        description={description}
        actions={
          <>
            <MarketingPrimaryLink href={MARKETING_ROUTES.contact} label={MARKETING_CTAS.bookDemo} variant="coral" showArrow />
            <EditorialTextLink href={MARKETING_ROUTES.pricing} label="View pricing" />
          </>
        }
      >
        <EditorialShowcasePanel
          eyebrow={`${name} pack`}
          counter={current?.status === 'available' ? 'Live' : 'Roadmap'}
          statement="Runs on Stride Core: the same login, employee records and payroll as the rest of your business."
          facts={[
            { value: features.length, label: 'workflows in this pack' },
            { value: 1, label: 'login with HR, payroll and finance' },
          ]}
        >
          {visual}
        </EditorialShowcasePanel>
      </EditorialPageHero>

      {/* 01 · What's in the pack */}
      <section className="border-t border-[var(--sc-line)] bg-white py-24 sm:py-28 lg:py-32" aria-labelledby="sector-pack-heading">
        <StudioCraftContainer>
          <EditorialSectionHead
            id="sector-pack-heading"
            index="01"
            total={total}
            label="What's in the pack"
            title={
              <>
                {name} workflows, <span className="text-[var(--sc-coral)]">on the core.</span>
              </>
            }
            note="Every workflow below shares employee records, approvals and finance with HR & Payroll, so nothing is re-keyed."
          />
          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:mt-20">
            {features.map((feature, index) => (
              <Reveal key={feature.title} delay={Math.min(index * 0.06, 0.24)}>
                <article className={`${EDITORIAL_CARD} flex h-full flex-col p-7 sm:p-8`}>
                  <span className="text-[clamp(2.5rem,4vw,3.5rem)] font-light leading-[0.85] tracking-[-0.05em] text-[rgba(26,23,20,0.14)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-10 text-[22px] font-medium leading-tight tracking-[-0.02em] text-[var(--sc-ink)]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.7] text-[var(--sc-ink-muted)]">{feature.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </StudioCraftContainer>
      </section>

      {/* 02 · Other packs */}
      <section className="bg-[var(--sc-paper-2)] py-24 sm:py-28 lg:py-32" aria-labelledby="sector-others-heading">
        <StudioCraftContainer>
          <EditorialSectionHead
            id="sector-others-heading"
            index="02"
            total={total}
            label="Other industry packs"
            title={
              <>
                One core. <span className="text-[var(--sc-coral)]">Add another pack any time.</span>
              </>
            }
            note="Packs stack on the same account, so a group with a fleet and a clinic runs both on one login."
          />
          <div className="mt-14 lg:mt-20">
            {others.map((vertical, index) => (
              <Reveal key={vertical.id} delay={Math.min(index * 0.05, 0.2)}>
                <Link
                  href={vertical.href}
                  className="group grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 border-t border-[var(--sc-line)] py-6 sm:grid-cols-[80px_minmax(0,1fr)_minmax(0,420px)_auto] sm:gap-8"
                >
                  <span className="text-[15px] font-medium text-[var(--sc-coral)]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-[clamp(1.375rem,2.2vw,1.75rem)] font-medium tracking-[-0.02em] text-[var(--sc-ink)] transition-colors group-hover:text-[var(--sc-coral)]">
                    {vertical.name}
                  </span>
                  <span className="hidden text-[15px] leading-[1.6] text-[var(--sc-ink-muted)] sm:line-clamp-2">{vertical.description}</span>
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--sc-line)] bg-white text-[var(--sc-ink)] transition-all group-hover:border-[var(--sc-coral)] group-hover:bg-[var(--sc-coral)] group-hover:text-white"
                    aria-hidden
                  >
                    →
                  </span>
                </Link>
              </Reveal>
            ))}
            <div className="border-t border-[var(--sc-line)]" />
          </div>
        </StudioCraftContainer>
      </section>

      {faq && faq.length > 0 ? <MarketingFaq items={faq.map((item) => ({ question: item.q, answer: item.a }))} /> : null}

      <MarketingCtaBand
        title={cta.title}
        description={cta.description}
        primary={{ href: MARKETING_ROUTES.contact, label: MARKETING_CTAS.bookDemo }}
        secondary={{ href: MARKETING_ROUTES.pricing, label: 'View pricing' }}
      />
    </>
  );
}
