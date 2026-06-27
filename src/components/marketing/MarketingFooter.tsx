import Link from 'next/link';
import { Linkedin } from 'lucide-react';
import { StrideWordmarkLockup } from '@/components/marketing/StrideMark';
import {
  MarketingPrimaryLink,
  MarketingSignInLink,
  StudioCraftContainer,
} from '@/components/marketing/v3/studio-craft-shared';
import {
  MARKETING_CTAS,
  MARKETING_LINKEDIN_URL,
  MARKETING_ROUTES,
  MARKETING_SALES_EMAIL,
} from '@/lib/marketing-config';

const FOOTER_PRODUCT_LINKS = [
  { href: MARKETING_ROUTES.platform, label: 'Platform' },
  { href: MARKETING_ROUTES.industries, label: 'Industries' },
  { href: MARKETING_ROUTES.pricing, label: 'Pricing' },
] as const;

const FOOTER_COMPANY_LINKS = [
  { href: MARKETING_ROUTES.about, label: 'About' },
  { href: MARKETING_ROUTES.privacy, label: 'Privacy' },
  { href: MARKETING_ROUTES.terms, label: 'Terms' },
  { href: MARKETING_ROUTES.contact, label: 'Contact' },
] as const;

function FooterNavColumn({
  title,
  links,
  className = '',
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
  className?: string;
}) {
  return (
    <nav aria-label={title} className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">{title}</p>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-[#C9C0B6] transition-colors hover:text-[var(--sc-coral)]"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MarketingFooter() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-white/10 bg-[var(--sc-ink,var(--pub-ink,#1a1714))] px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[35%] bg-[radial-gradient(120%_85%_at_50%_100%,rgba(255,84,54,0.22)_0%,rgba(255,84,54,0.1)_32%,rgba(26,23,20,0)_68%)]"
      />

      <StudioCraftContainer className="relative px-0">
        <div className="grid gap-10 max-lg:grid-cols-1 lg:grid-cols-12 lg:gap-10">
          <div className="max-lg:contents lg:col-span-4 lg:flex lg:flex-col">
            <div className="max-lg:order-1 max-lg:flex max-lg:flex-col max-lg:items-center max-lg:text-center">
              <Link href={MARKETING_ROUTES.home}>
                <StrideWordmarkLockup theme="on-ink" markClassName="h-6" wordClassName="text-xl" />
              </Link>
              <p className="mt-3 text-sm italic !text-[var(--sc-coral)]">Hit your stride.</p>
            </div>

            <div className="max-lg:order-2 max-lg:flex max-lg:flex-col max-lg:items-center max-lg:text-center lg:mt-4">
              <p className="max-w-xs text-sm leading-relaxed text-[#C9C0B6] max-lg:max-w-sm">
                One operations platform for East African businesses — HR, finance, and industry packs
                on a single data layer.
              </p>
              <div className="mt-4 flex flex-col items-start gap-3 max-lg:items-center">
                <a
                  href={`mailto:${MARKETING_SALES_EMAIL}`}
                  className="text-sm text-[#C9C0B6] transition-colors hover:text-[var(--sc-coral)]"
                >
                  {MARKETING_SALES_EMAIL}
                </a>
                <a
                  href={MARKETING_LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#C9C0B6] transition-colors hover:bg-white/5 hover:text-[var(--sc-coral)]"
                  aria-label="Stride on LinkedIn (opens in new tab)"
                >
                  <Linkedin className="h-4 w-4 shrink-0" aria-hidden />
                </a>
              </div>
            </div>
          </div>

          <div className="flex max-lg:order-3 max-lg:justify-center max-lg:gap-12 lg:col-span-4 lg:grid lg:grid-cols-2 lg:gap-12">
            <FooterNavColumn title="Product" links={FOOTER_PRODUCT_LINKS} className="min-w-[7.25rem]" />
            <FooterNavColumn title="Company" links={FOOTER_COMPANY_LINKS} className="min-w-[7.25rem]" />
          </div>

          <div className="max-lg:order-4 max-lg:flex max-lg:flex-col max-lg:items-center max-lg:text-center lg:col-span-4 lg:justify-self-end">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">
              Get started
            </p>
            <p className="mt-4 hidden max-w-sm text-sm leading-relaxed text-[#C9C0B6] sm:block max-lg:max-w-md">
              See how Stride fits your team — we&apos;ll walk through core modules and any vertical
              packs you need.
            </p>
            <div className="marketing-footer-cta mt-4 flex w-full max-w-sm flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center lg:max-w-none lg:flex-col lg:items-stretch">
              <MarketingPrimaryLink
                href={MARKETING_ROUTES.contact}
                label={MARKETING_CTAS.bookDemo}
                fullWidth
              />
              <MarketingSignInLink tone="dark" fullWidth />
            </div>
          </div>
        </div>

        <div className="marketing-footer-meta mt-10 border-t border-white/10 pt-8 text-xs text-[#8A8076] max-lg:text-center sm:mt-12">
          <p suppressHydrationWarning>
            © {new Date().getFullYear()} Stride. A Raven Tech Group product.
          </p>
        </div>
      </StudioCraftContainer>
    </footer>
  );
}
