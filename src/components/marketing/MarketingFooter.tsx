import Link from 'next/link';
import { Linkedin } from 'lucide-react';
import { StrideWordmarkLockup } from '@/components/marketing/StrideMark';
import {
  MarketingPrimaryLink,
  MarketingSignInLink,
  StudioCraftContainer,
} from '@/components/marketing/v3/studio-craft-shared';
import {
  isDemoAccessPageEnabled,
  getDemoAccessRows,
} from '@/lib/demo-access';
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
  { href: '/careers', label: 'Careers' },
  { href: MARKETING_ROUTES.about, label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: MARKETING_ROUTES.contact, label: 'Contact' },
] as const;

function FooterNavColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <nav aria-label={title}>
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

function FooterDemoSandbox() {
  const rows = getDemoAccessRows();

  return (
    <div className="mt-12 border-t border-white/10 pt-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">
            Demo sandbox
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-[#C9C0B6]">
            Try the seeded Heritage Members SACCO walkthrough. Password shared on request — not
            published here.
          </p>
        </div>
        <dl className="grid w-full max-w-lg gap-3 sm:grid-cols-2 lg:gap-x-8">
          {rows.map((row) => (
            <div key={row.role}>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">
                {row.role}
              </dt>
              <dd className="mt-1">
                <code className="break-all font-mono text-[0.8125rem] text-[#E8E2DA]">{row.email}</code>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-5 text-xs text-[#8A8076]">
        <Link
          href={MARKETING_ROUTES.demoAccess}
          className="text-[#8A8076] transition-colors hover:text-[var(--sc-coral)]"
        >
          Sandbox sign-in URLs and roles →
        </Link>
      </p>
    </div>
  );
}

export function MarketingFooter() {
  const showDemoAccess = isDemoAccessPageEnabled();

  return (
    <footer className="relative isolate overflow-hidden border-t border-white/10 bg-[var(--sc-ink,var(--pub-ink,#1a1714))] px-5 py-12 sm:px-8 sm:py-16 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[35%] bg-[radial-gradient(120%_85%_at_50%_100%,rgba(255,84,54,0.22)_0%,rgba(255,84,54,0.1)_32%,rgba(26,23,20,0)_68%)]"
      />

      <StudioCraftContainer className="relative px-0">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <Link href={MARKETING_ROUTES.home}>
              <StrideWordmarkLockup theme="on-ink" markClassName="h-6" wordClassName="text-xl" />
            </Link>
            <p className="mt-3 text-sm italic !text-[var(--sc-coral)]">Hit your stride.</p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#C9C0B6]">
              One operations platform for East African businesses — HR, finance, and industry packs
              on a single data layer.
            </p>
            <div className="mt-4 flex flex-col items-start gap-3">
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

          <div className="grid grid-cols-2 gap-10 sm:gap-12 lg:col-span-4">
            <FooterNavColumn title="Product" links={FOOTER_PRODUCT_LINKS} />
            <FooterNavColumn title="Company" links={FOOTER_COMPANY_LINKS} />
          </div>

          <div className="lg:col-span-4 lg:justify-self-end">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">
              Get started
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#C9C0B6]">
              See how Stride fits your team — we&apos;ll walk through core modules and any vertical
              packs you need.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
              <MarketingPrimaryLink
                href={MARKETING_ROUTES.contact}
                label={MARKETING_CTAS.bookDemo}
                fullWidth
              />
              <MarketingSignInLink tone="dark" fullWidth />
            </div>
          </div>
        </div>

        {showDemoAccess ? <FooterDemoSandbox /> : null}

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-8 text-xs text-[#8A8076] sm:flex-row sm:items-center sm:justify-between">
          <p suppressHydrationWarning>
            © {new Date().getFullYear()} Stride. A Raven Tech Group product.
          </p>
          <p>Built in Nairobi · East Africa</p>
        </div>
      </StudioCraftContainer>
    </footer>
  );
}
