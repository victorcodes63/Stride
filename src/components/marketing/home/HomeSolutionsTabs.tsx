'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ArrowRight, Check } from '@phosphor-icons/react';
import { Reveal } from '@/components/marketing/motion';
import { CoreDashboardWireframe } from '@/components/marketing/mockups/CoreDashboardWireframe';
import {
  IndustryWireframePreview,
  MarketingScreenshotFrame,
} from '@/components/marketing/mockups/IndustryWireframePreview';
import { PlatformModulesWireframe } from '@/components/marketing/mockups/PlatformModulesWireframe';
import { StatutoryWireframe } from '@/components/marketing/mockups/StatutoryWireframe';
import { StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { MARKETING_ROUTES } from '@/lib/marketing-config';

type Solution = {
  id: string;
  tab: string;
  title: string;
  body: string;
  points: readonly string[];
  link: { href: string; label: string };
  visual: ReactNode;
};

const SOLUTIONS: readonly Solution[] = [
  {
    id: 'people',
    tab: 'HR & Payroll',
    title: 'Every employee record, payslip and approval in one place.',
    body: 'Profiles, leave, attendance and payroll share one record, so nothing is re-keyed between HR and finance.',
    points: [
      'Employee self-service on mobile',
      'Leave, attendance and approvals feeding payroll',
      'Payslips and P9s generated on every run',
    ],
    link: { href: MARKETING_ROUTES.platform, label: 'Explore HR & Payroll' },
    visual: (
      <MarketingScreenshotFrame moduleLabel="HR & Payroll" screenTitle="People overview" path="/dashboard">
        <CoreDashboardWireframe />
      </MarketingScreenshotFrame>
    ),
  },
  {
    id: 'compliance',
    tab: 'Compliance & payouts',
    title: 'Kenyan statutory rules built in, not approximated.',
    body: 'PAYE, NSSF, SHIF and Housing Levy are calculated on every run, and salaries go out over M-Pesa with reconciliation back to payroll.',
    points: [
      'iTax-ready statutory exports',
      'Bulk M-Pesa salary disbursement',
      'Audit trail from approval to payout',
    ],
    link: { href: MARKETING_ROUTES.platform, label: 'See how compliance works' },
    visual: (
      <MarketingScreenshotFrame
        moduleLabel="Payroll · Kenya"
        screenTitle="Statutory compliance"
        path="/dashboard/payroll/statutory"
      >
        <StatutoryWireframe />
      </MarketingScreenshotFrame>
    ),
  },
  {
    id: 'finance',
    tab: 'Finance & modules',
    title: 'Finance at the core, with modules you add when you need them.',
    body: 'Payroll posts straight to the ledger. Add procurement, legal, projects or admin as plug-ins on the same login and the same data.',
    points: [
      'Invoicing and ledger on every plan',
      'Plug-in modules without a second system',
      'Multi-entity across Kenya and Uganda',
    ],
    link: { href: MARKETING_ROUTES.platform, label: 'View all modules' },
    visual: (
      <MarketingScreenshotFrame moduleLabel="Stride Core" screenTitle="Platform overview" path="/dashboard">
        <PlatformModulesWireframe />
      </MarketingScreenshotFrame>
    ),
  },
  {
    id: 'industries',
    tab: 'Industry packs',
    title: 'Depth for the work that defines your industry.',
    body: 'Logistics, SACCOs, healthcare, energy, construction and HR consultancies each get a vertical pack on the same core.',
    points: [
      'Trip-to-invoice for logistics fleets',
      'Member and loan operations for SACCOs',
      'Same records and compliance underneath',
    ],
    link: { href: MARKETING_ROUTES.industries, label: 'Browse industries' },
    visual: <IndustryWireframePreview industryId="logistics" />,
  },
];

export function HomeSolutionsTabs() {
  const [activeId, setActiveId] = useState(SOLUTIONS[0]!.id);
  const active = SOLUTIONS.find((solution) => solution.id === activeId) ?? SOLUTIONS[0]!;

  return (
    <section className="bg-[var(--sc-paper)] py-24 sm:py-28 lg:py-36" aria-labelledby="home-solutions-heading">
      <StudioCraftContainer>
        <Reveal className="mx-auto max-w-[720px] text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--sc-coral)]">
            One platform
          </p>
          <h2
            id="home-solutions-heading"
            className="mt-4 text-[clamp(2rem,4.2vw,3.25rem)] font-medium leading-[1.08] [text-wrap:balance] tracking-[-0.022em] text-[var(--sc-ink)]"
          >
            Everything your operations run on.
          </h2>
          <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-[1.7] text-[var(--sc-ink-muted)]">
            Start with HR, payroll and finance. Add the rest when your business needs it.
          </p>
        </Reveal>

        <div className="mt-14 rounded-[28px] bg-[var(--sc-paper-2)] p-3 sm:p-4 lg:mt-16">
          <div
            role="tablist"
            aria-label="Stride solutions"
            className="flex gap-1 overflow-x-auto rounded-2xl bg-white/70 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SOLUTIONS.map((solution) => {
              const selected = solution.id === active.id;
              return (
                <button
                  key={solution.id}
                  type="button"
                  role="tab"
                  id={`solution-tab-${solution.id}`}
                  aria-selected={selected}
                  aria-controls={`solution-panel-${solution.id}`}
                  onClick={() => setActiveId(solution.id)}
                  className={`min-h-11 flex-1 whitespace-nowrap rounded-xl px-4 text-[14px] font-semibold transition-colors sm:text-[15px] ${
                    selected
                      ? 'bg-[var(--sc-ink)] text-[#FBF8F4] shadow-sm'
                      : 'text-[var(--sc-ink-muted)] hover:bg-white hover:text-[var(--sc-ink)]'
                  }`}
                >
                  {solution.tab}
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`solution-panel-${active.id}`}
            aria-labelledby={`solution-tab-${active.id}`}
            className="grid items-center gap-10 px-3 pb-6 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14 lg:px-10 lg:pb-10 lg:pt-12"
          >
            <div key={active.id} className="sc-animate-fade-up min-w-0">
              <h3 className="text-[clamp(1.5rem,2.6vw,2.125rem)] font-medium leading-[1.15] tracking-[-0.02em] text-[var(--sc-ink)]">
                {active.title}
              </h3>
              <p className="mt-5 text-[16px] leading-[1.7] text-[var(--sc-ink-muted)] sm:text-[17px]">
                {active.body}
              </p>
              <ul className="mt-7 space-y-3.5">
                {active.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-[15px] text-[var(--sc-ink)]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--sc-coral)]/12 text-[var(--sc-coral)]">
                      <Check size={12} weight="bold" aria-hidden />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                href={active.link.href}
                className="group mt-9 inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--sc-coral)] transition-colors hover:text-[var(--sc-coral-deep)]"
              >
                {active.link.label}
                <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>

            <div key={`${active.id}-visual`} className="sc-animate-hero-fade-in h-[320px] min-w-0 sm:h-[400px] lg:h-[440px]">
              {active.visual}
            </div>
          </div>
        </div>
      </StudioCraftContainer>
    </section>
  );
}
