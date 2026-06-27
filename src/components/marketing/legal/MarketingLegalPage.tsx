import Link from 'next/link';

import {
  MarketingPageHero,
  MarketingPageHeroDescription,
  MarketingPageHeroEyebrow,
  MarketingPageHeroTitle,
} from '@/components/marketing/MarketingPageHero';
import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import type { MarketingLegalPageProps } from '@/components/marketing/legal/legal-types';

function formatLastUpdated(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function MarketingLegalPage({
  eyebrow,
  title,
  description,
  lastUpdated,
  sections,
}: MarketingLegalPageProps) {
  return (
    <>
      <MarketingPageHero>
        <MarketingPageHeroEyebrow>{eyebrow}</MarketingPageHeroEyebrow>
        <MarketingPageHeroTitle className="mt-5 max-w-[720px]">{title}</MarketingPageHeroTitle>
        <MarketingPageHeroDescription className="mt-4">{description}</MarketingPageHeroDescription>
        <p className="mt-5 text-sm text-[var(--sc-ink-muted)]">
          Last updated{' '}
          <time dateTime={lastUpdated} className="font-medium text-[var(--sc-ink)]">
            {formatLastUpdated(lastUpdated)}
          </time>
        </p>
      </MarketingPageHero>

      <div className="border-t border-[var(--sc-line)] bg-[var(--sc-paper)] pb-16 pt-10 sm:pb-20 sm:pt-12">
        <StudioCraftContainer>
          <div className="lg:grid lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-x-12 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] xl:gap-x-16">
            <nav
              aria-label="On this page"
              className="mb-10 lg:sticky lg:top-[calc(var(--nav-h)+1.25rem)] lg:mb-0 lg:max-h-[calc(100vh-var(--nav-h)-2rem)] lg:self-start lg:overflow-y-auto"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--sc-coral)]">
                On this page
              </p>
              <ol className="mt-4 space-y-2 border-l border-[var(--sc-line)] pl-4">
                {sections.map((section) => (
                  <li key={section.id}>
                    <Link
                      href={`#${section.id}`}
                      className="block text-sm leading-snug text-[var(--sc-ink-muted)] transition-colors hover:text-[var(--sc-coral)] focus:outline-none focus-visible:text-[var(--sc-coral)] focus-visible:underline"
                    >
                      {section.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>

            <article className="marketing-legal-prose min-w-0 max-w-[720px]">
              {sections.map((section, index) => (
                <section
                  key={section.id}
                  id={section.id}
                  className={`scroll-mt-[calc(var(--nav-h)+1rem)] ${index > 0 ? 'mt-12 border-t border-[var(--sc-line)] pt-12' : ''}`}
                >
                  <h2 className="text-xl font-semibold tracking-tight text-[var(--sc-ink)] sm:text-[1.375rem]">
                    {section.title}
                  </h2>
                  <div className="mt-4 space-y-4 text-base leading-relaxed text-[var(--sc-ink-muted)] [&_a]:font-medium [&_a]:text-[var(--sc-coral)] [&_a]:underline-offset-2 hover:[&_a]:underline [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--sc-ink)] [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p+p]:mt-4 [&_strong]:font-semibold [&_strong]:text-[var(--sc-ink)] [&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:border-[var(--sc-line)] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:border [&_th]:border-[var(--sc-line)] [&_th]:bg-[var(--sc-paper-2)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-[var(--sc-ink)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                    {section.content}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </StudioCraftContainer>
      </div>
    </>
  );
}
