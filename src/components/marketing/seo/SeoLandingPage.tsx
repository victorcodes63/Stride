import Link from 'next/link';
import { Check } from '@phosphor-icons/react/dist/ssr';
import { EditorialPageHero } from '@/components/marketing/editorial/EditorialPageHero';
import { MarketingCtaBand } from '@/components/marketing/MarketingCtaBand';
import { JsonLd } from '@/components/marketing/JsonLd';
import { MarketingFaq } from '@/components/marketing/sections/MarketingFaq';
import {
  ProductCompliancePayoutSlice,
  ProductComplianceStatutorySlice,
  ProductOverviewSlice,
  ProductPeopleWorkforceSlice,
} from '@/components/marketing/product/ProductSlices';
import { Reveal } from '@/components/marketing/motion';
import { MarketingPrimaryLink, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { MARKETING_CTAS, MARKETING_ROUTES } from '@/lib/marketing-config';
import { webPageJsonLd } from '@/lib/marketing-schema';
import type { SeoLandingDefinition } from '@/lib/marketing-seo-landings';

function LandingVisual({ visual }: { visual: SeoLandingDefinition['visual'] }) {
  switch (visual) {
    case 'people':
      return <ProductPeopleWorkforceSlice fill designWidth={720} />;
    case 'statutory':
      return <ProductComplianceStatutorySlice fill designWidth={560} />;
    case 'payout':
      return <ProductCompliancePayoutSlice fill designWidth={560} />;
    case 'overview':
      return <ProductOverviewSlice domains={['hr-payroll']} fill designWidth={640} />;
    default:
      return null;
  }
}

export function SeoLandingPage({ landing }: { landing: SeoLandingDefinition }) {
  return (
    <>
      <JsonLd
        data={webPageJsonLd({
          name: `${landing.title} | Stride`,
          description: landing.description,
          path: landing.path,
        })}
      />

      <EditorialPageHero
        size="page"
        badge={landing.badge}
        breadcrumb={[
          { name: 'Home', path: '/' },
          { name: landing.title, path: landing.path },
        ]}
        title={
          <>
            {landing.headlineLead}{' '}
            <span className="text-[var(--sc-coral)]">{landing.headlineAccent}</span>
          </>
        }
        description={landing.intro}
        actions={
          <>
            <MarketingPrimaryLink
              href={MARKETING_ROUTES.contact}
              label={MARKETING_CTAS.bookDemo}
              variant="coral"
              showArrow
            />
            <Link
              href={MARKETING_ROUTES.pricing}
              className="group inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-[var(--sc-ink)] transition-colors hover:text-[var(--sc-coral)]"
            >
              View pricing
              <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                →
              </span>
            </Link>
          </>
        }
      >
        <div className="relative mx-auto h-[300px] w-full max-w-[720px] overflow-hidden sm:h-[380px] lg:h-[420px] lg:max-w-none">
          <LandingVisual visual={landing.visual} />
        </div>
      </EditorialPageHero>

      <section className="border-t border-[var(--sc-line)] bg-white py-20 sm:py-24 lg:py-28">
        <StudioCraftContainer>
          <div className="mx-auto max-w-[720px] text-center">
            <Reveal>
              <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-medium tracking-[-0.02em] text-[var(--sc-ink)]">
                Why teams choose Stride
              </h2>
            </Reveal>
          </div>
          <div className="mx-auto mt-12 grid max-w-[1000px] gap-8 sm:mt-14 sm:gap-10 lg:grid-cols-3">
            {landing.points.map((point, index) => (
              <Reveal key={point.title} delay={0.04 * index}>
                <article className="text-left">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sc-coral)]/12 text-[var(--sc-coral)]">
                    <Check size={14} weight="bold" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.015em] text-[var(--sc-ink)]">
                    {point.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--sc-ink-muted)]">{point.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </StudioCraftContainer>
      </section>

      <MarketingFaq items={landing.faq} />

      <section className="border-t border-[var(--sc-line)] bg-[var(--sc-paper-2)] py-14 sm:py-16">
        <StudioCraftContainer>
          <p className="text-center text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--sc-ink-muted)]">
            Related
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {landing.related.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-[15px] font-semibold text-[var(--sc-coral)] transition-colors hover:text-[var(--sc-coral-deep)]"
                >
                  {link.label} →
                </Link>
              </li>
            ))}
          </ul>
        </StudioCraftContainer>
      </section>

      <MarketingCtaBand
        title={
          <>
            See Stride on <span className="text-[var(--sc-coral)]">your numbers.</span>
          </>
        }
        description="Book a walkthrough or start with a free payroll run alongside your current process."
        primary={{ href: MARKETING_ROUTES.contact, label: MARKETING_CTAS.bookDemo }}
        secondary={{ href: MARKETING_ROUTES.pricing, label: 'View pricing' }}
      />
    </>
  );
}
