import type { Icon } from '@phosphor-icons/react';
import { DownloadSimple, ListChecks, LockSimple, ShieldCheck } from '@phosphor-icons/react/dist/ssr';
import { CountUp, Reveal } from '@/components/marketing/motion';
import { EditorialNumberedRows, EditorialTextLink, EDITORIAL_CARD } from '@/components/marketing/editorial/EditorialParts';
import { EditorialPageHero } from '@/components/marketing/editorial/EditorialPageHero';
import { EditorialSectionHead } from '@/components/marketing/editorial/EditorialSectionHead';
import { MarketingPrimaryLink, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import {
  ABOUT_ORIGIN,
  ABOUT_PAGE,
  ABOUT_PRINCIPLES,
  ABOUT_TRUST,
  MARKETING_CTAS,
  MARKETING_ROUTES,
  PLATFORM_MODULES,
  RAVEN_TECH_URL,
} from '@/lib/marketing-config';
import { AboutFinalCta } from './AboutFinalCta';

const TOTAL = 3;

const TRUST_ICONS: Record<(typeof ABOUT_TRUST.items)[number]['icon'], Icon> = {
  'shield-check': ShieldCheck,
  lock: LockSimple,
  download: DownloadSimple,
  'list-checks': ListChecks,
};

/** First stat is derived from the module registry so it never drifts from /platform. */
const STATS = [
  { value: String(PLATFORM_MODULES.length), label: 'Product areas on one login' },
  ...ABOUT_PAGE.stats.slice(1),
];

function StatValue({ value }: { value: string }) {
  const match = value.match(/^(\d+)(.*)$/);
  const className = 'text-[clamp(2.5rem,4vw,3.5rem)] font-medium leading-none tracking-[-0.04em] text-[var(--sc-ink)]';
  if (match) {
    return <CountUp value={Number.parseInt(match[1]!, 10)} suffix={match[2] ?? ''} className={className} />;
  }
  return <span className={className}>{value}</span>;
}

function AboutHeroSection() {
  const { hero } = ABOUT_PAGE;
  return (
    <EditorialPageHero
      breadcrumb={[
        { name: 'Home', path: '/' },
        { name: 'About', path: '/about' },
      ]}
      badge={hero.eyebrow}
      title={
        <>
          {hero.titleLines[0]} <span className="text-[var(--sc-coral)]">{hero.titleLines[1]}</span>
        </>
      }
      description={
        <>
          {hero.description}{' '}
          <span className="text-[var(--sc-ink-subtle)]">
            A{' '}
            <a href={RAVEN_TECH_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--sc-coral)] hover:underline">
              Raven Tech Group
            </a>{' '}
            product.
          </span>
        </>
      }
      actions={
        <>
          <MarketingPrimaryLink href={MARKETING_ROUTES.contact} label={MARKETING_CTAS.bookDemo} variant="coral" showArrow />
          <EditorialTextLink href={MARKETING_ROUTES.platform} label="Explore the platform" />
        </>
      }
    >
      <dl className="grid grid-cols-2 border-t border-[var(--sc-line)] lg:grid-cols-4">
        {STATS.map((stat, index) => (
          <Reveal
            key={stat.label}
            delay={Math.min(index * 0.05, 0.2)}
            className={`py-8 pr-6 sm:py-10 ${index % 2 === 1 ? 'border-l border-[var(--sc-line)] pl-6' : ''} ${
              index >= 2 ? 'border-t border-[var(--sc-line)] lg:border-t-0' : ''
            } ${index === 2 ? 'lg:border-l lg:pl-6' : ''}`}
          >
            <dt>
              <StatValue value={stat.value} />
            </dt>
            <dd className="mt-3 max-w-[16rem] text-[14px] leading-relaxed text-[var(--sc-ink-muted)]">{stat.label}</dd>
          </Reveal>
        ))}
      </dl>
    </EditorialPageHero>
  );
}

function AboutStorySection() {
  return (
    <section className="bg-[var(--sc-paper-2)] py-24 sm:py-28 lg:py-32" aria-labelledby="about-story-heading">
      <StudioCraftContainer>
        <EditorialSectionHead
          id="about-story-heading"
          index="01"
          total={TOTAL}
          label={ABOUT_ORIGIN.badge}
          title={ABOUT_ORIGIN.heading}
        />
        <div className="mt-14 grid gap-10 lg:mt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <Reveal>
            <p className="text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium leading-[1.25] tracking-[-0.02em] text-[var(--sc-ink)] lg:sticky lg:top-[calc(var(--nav-h)+3rem)]">
              <span className="text-[var(--sc-coral)]">“</span>
              {ABOUT_ORIGIN.lead}
              <span className="text-[var(--sc-coral)]">”</span>
            </p>
          </Reveal>
          <div className="space-y-6">
            {ABOUT_ORIGIN.paragraphs.map((paragraph, index) => (
              <Reveal key={index} delay={0.06 * (index + 1)}>
                <div className={`${EDITORIAL_CARD} p-7 sm:p-8`}>
                  <span className="text-[13px] font-medium text-[var(--sc-coral)]">{String(index + 1).padStart(2, '0')}</span>
                  <p className="mt-4 text-[16px] leading-[1.75] text-[var(--sc-ink-muted)] sm:text-[17px]">
                    {'emphasis' in paragraph ? (
                      <>
                        {paragraph.text}
                        <strong className="font-medium text-[var(--sc-ink)]">{paragraph.emphasis}</strong>
                        {paragraph.textAfter}
                      </>
                    ) : (
                      paragraph.text
                    )}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </StudioCraftContainer>
    </section>
  );
}

function AboutPrinciplesSection() {
  const { principles } = ABOUT_PAGE;
  return (
    <section className="bg-white py-24 sm:py-28 lg:py-32" aria-labelledby="about-principles-heading">
      <StudioCraftContainer>
        <EditorialSectionHead
          id="about-principles-heading"
          index="02"
          total={TOTAL}
          label={principles.badge}
          title={
            <>
              Three principles we <span className="text-[var(--sc-coral)]">do not compromise on.</span>
            </>
          }
          note={<EditorialTextLink href={MARKETING_ROUTES.platform} label="See them in the platform" />}
        />
        <div className="mt-14 lg:mt-20">
          <EditorialNumberedRows items={ABOUT_PRINCIPLES.map((p) => ({ title: p.title, body: p.body }))} />
        </div>
      </StudioCraftContainer>
    </section>
  );
}

function AboutTrustSection() {
  return (
    <section className="bg-[var(--sc-paper-2)] py-24 sm:py-28 lg:py-32" aria-labelledby="about-trust-heading">
      <StudioCraftContainer>
        <EditorialSectionHead
          id="about-trust-heading"
          index="03"
          total={TOTAL}
          label={ABOUT_TRUST.badge}
          title={
            <>
              Your data, <span className="text-[var(--sc-coral)]">handled properly.</span>
            </>
          }
          note="How we look after the employee, payroll and finance records you trust us with."
        />
        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {ABOUT_TRUST.items.map((item, index) => {
            const IconComponent = TRUST_ICONS[item.icon];
            const featured = index === 0;
            return (
              <Reveal key={item.id} delay={Math.min(index * 0.05, 0.2)}>
                <article
                  className={`flex h-full min-h-[260px] flex-col p-7 ${
                    featured
                      ? 'sc-on-ink rounded-[22px] bg-[var(--sc-ink)] text-white shadow-[0_30px_70px_-36px_rgba(26,23,20,0.7)]'
                      : EDITORIAL_CARD
                  }`}
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${
                      featured ? 'bg-[var(--sc-coral)] text-white' : 'bg-[var(--sc-coral)]/10 text-[var(--sc-coral)]'
                    }`}
                  >
                    <IconComponent size={24} weight="duotone" aria-hidden />
                  </span>
                  <h3 className={`mt-auto pt-10 text-[22px] font-medium leading-tight tracking-[-0.02em] ${featured ? 'text-white' : 'text-[var(--sc-ink)]'}`}>
                    {item.title}
                  </h3>
                  <p className={`mt-3 text-[15px] leading-[1.7] ${featured ? 'text-white/65' : 'text-[var(--sc-ink-muted)]'}`}>{item.body}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </StudioCraftContainer>
    </section>
  );
}

export function AboutPageContent() {
  return (
    <>
      <AboutHeroSection />
      <AboutStorySection />
      <AboutPrinciplesSection />
      <AboutTrustSection />
      <AboutFinalCta />
    </>
  );
}
