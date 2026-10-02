import Link from 'next/link';
import { Linkedin } from 'lucide-react';
import { StrideWordmarkLockup } from '@/components/marketing/StrideMark';
import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { STRIDE_WORDMARK_SRC } from '@/lib/brand-constants';
import {
  INDUSTRY_VERTICALS,
  MARKETING_LINKEDIN_URL,
  MARKETING_ROUTES,
  MARKETING_SALES_EMAIL,
  getMarketingLoginUrl,
} from '@/lib/marketing-config';
import { PRICING_INTENTS, contactHref } from '@/lib/pricing';

type FooterLink = { href: string; label: string; external?: boolean };

const PRODUCT_LINKS: FooterLink[] = [
  { href: MARKETING_ROUTES.platform, label: 'Platform overview' },
  { href: MARKETING_ROUTES.pricing, label: 'Pricing' },
  { href: contactHref(PRICING_INTENTS.parallelRun), label: 'Free payroll run' },
  { href: MARKETING_ROUTES.contact, label: 'Book a demo' },
  { href: getMarketingLoginUrl(), label: 'Sign in' },
];

/** Descriptive anchor text doubles as internal linking for search. */
const PAYROLL_LINKS: FooterLink[] = [
  { href: MARKETING_ROUTES.platform, label: 'Payroll software Kenya' },
  { href: MARKETING_ROUTES.platform, label: 'PAYE, NSSF & SHIF' },
  { href: MARKETING_ROUTES.platform, label: 'Housing Levy' },
  { href: MARKETING_ROUTES.platform, label: 'M-Pesa salary payouts' },
  { href: MARKETING_ROUTES.platform, label: 'HR & leave management' },
];

const INDUSTRY_LINKS: FooterLink[] = INDUSTRY_VERTICALS.map((vertical) => ({
  href: vertical.href,
  label: vertical.name,
}));

const COMPANY_LINKS: FooterLink[] = [
  { href: MARKETING_ROUTES.about, label: 'About Stride' },
  { href: MARKETING_ROUTES.contact, label: 'Contact' },
  { href: MARKETING_ROUTES.privacy, label: 'Privacy' },
  { href: MARKETING_ROUTES.terms, label: 'Terms' },
];

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <nav aria-label={title} className="min-w-0">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/40">{title}</p>
      <ul className="mt-5 space-y-3.5">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            <Link
              href={link.href}
              className="group relative inline-flex text-[15px] text-white/70 transition-colors duration-200 hover:text-white"
            >
              {link.label}
              <span
                aria-hidden
                className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-[var(--sc-coral)] transition-transform duration-300 ease-out group-hover:scale-x-100"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MarketingFooter() {
  return (
    <footer className="sc-on-ink relative isolate overflow-hidden bg-[var(--sc-ink,#1a1714)] text-white">
      {/* A hairline that glows coral in the middle, separating CTA band and footer. */}
      <div
        aria-hidden
        className="h-px w-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12)_20%,rgba(255,84,54,0.6)_50%,rgba(255,255,255,0.12)_80%,transparent)]"
      />

      <StudioCraftContainer>
        <div className="grid gap-14 pb-16 pt-16 sm:pt-20 lg:grid-cols-12 lg:gap-10 lg:pb-20 lg:pt-24">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Link href={MARKETING_ROUTES.home} aria-label="Stride home" className="inline-flex">
              <StrideWordmarkLockup theme="on-ink" markClassName="h-7" wordClassName="text-xl" />
            </Link>
            <p className="mt-6 max-w-[22rem] text-[15px] leading-[1.7] text-white/60">
              Payroll, HR and finance software for Kenyan businesses, with industry packs on the same
              platform.
            </p>

            <div className="mt-8 space-y-3 text-[15px]">
              <a
                href={`mailto:${MARKETING_SALES_EMAIL}`}
                className="block text-white/80 transition-colors hover:text-[var(--sc-coral)]"
              >
                {MARKETING_SALES_EMAIL}
              </a>
              <p className="text-white/45">Westlands, Nairobi</p>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <a
                href={MARKETING_LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Stride on LinkedIn (opens in new tab)"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition-colors hover:border-[var(--sc-coral)]/50 hover:text-[var(--sc-coral)]"
              >
                <Linkedin className="h-4 w-4" aria-hidden />
              </a>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-[12px] text-white/55">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                ODPC-ready data handling
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-4 lg:col-span-8">
            <FooterColumn title="Product" links={PRODUCT_LINKS} />
            <FooterColumn title="Payroll & HR" links={PAYROLL_LINKS} />
            <FooterColumn title="Industries" links={INDUSTRY_LINKS} />
            <FooterColumn title="Company" links={COMPANY_LINKS} />
          </div>
        </div>
      </StudioCraftContainer>

      {/* Oversized wordmark, fading into the page edge. */}
      <div className="pointer-events-none relative select-none" aria-hidden>
        <StudioCraftContainer>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={STRIDE_WORDMARK_SRC}
            alt=""
            className="mx-auto block h-auto w-full opacity-[0.09] [mask-image:linear-gradient(to_bottom,black_15%,transparent_95%)]"
          />
        </StudioCraftContainer>
      </div>

      <StudioCraftContainer>
        <div className="flex flex-col gap-4 border-t border-white/10 py-7 text-[13px] text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p suppressHydrationWarning>
            © {new Date().getFullYear()} Stride · A Raven Tech Group product
          </p>
          <div className="flex items-center gap-6">
            <span>Built in Nairobi</span>
            <a href="#" className="inline-flex items-center gap-1.5 text-white/60 transition-colors hover:text-white">
              Back to top
              <span aria-hidden>↑</span>
            </a>
          </div>
        </div>
      </StudioCraftContainer>
    </footer>
  );
}
