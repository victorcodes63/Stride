'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { ArrowRight, Check } from '@phosphor-icons/react';
import { MOTION_EASE, Reveal } from '@/components/marketing/motion';
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
  /** Coded mock shown until a real screenshot is set below. */
  visual: ReactNode;
  /**
   * Real product screenshot. When set, it replaces `visual`. Drop the PNG in
   * /public/marketing/ and point `src` at it, e.g. '/marketing/solutions-payroll.png'.
   */
  screenshot?: { src: string; alt: string };
};

const AUTO_ADVANCE_MS = 7000;

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
  const [paused, setPaused] = useState(false);
  const [userPicked, setUserPicked] = useState(false);
  const [cycle, setCycle] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const inView = useInView(panelRef, { margin: '-20% 0px -20% 0px' });
  const reduceMotion = useReducedMotion();
  const active = SOLUTIONS.find((solution) => solution.id === activeId) ?? SOLUTIONS[0]!;

  // Auto-advance while the panel is on screen; stops for good once someone picks a tab.
  const autoplay = !reduceMotion && !userPicked && !paused && inView;

  const advance = useCallback(() => {
    setActiveId((current) => {
      const index = SOLUTIONS.findIndex((solution) => solution.id === current);
      return SOLUTIONS[(index + 1) % SOLUTIONS.length]!.id;
    });
    setCycle((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setTimeout(advance, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, advance, activeId, cycle]);

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

        <div
          ref={panelRef}
          className="mt-14 rounded-[28px] bg-[var(--sc-paper-2)] p-3 sm:p-4 lg:mt-16"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
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
                  onClick={() => {
                    setUserPicked(true);
                    setActiveId(solution.id);
                  }}
                  className={`relative min-h-11 flex-1 overflow-hidden whitespace-nowrap rounded-xl px-4 text-[14px] font-semibold transition-colors sm:text-[15px] ${
                    selected
                      ? 'bg-[var(--sc-ink)] text-[#FFFFFF] shadow-sm'
                      : 'text-[var(--sc-ink-muted)] hover:bg-white hover:text-[var(--sc-ink)]'
                  }`}
                >
                  {solution.tab}
                  {selected && autoplay ? (
                    <motion.span
                      key={`${solution.id}-${cycle}`}
                      aria-hidden
                      className="absolute inset-x-3 bottom-1 h-[2px] origin-left rounded-full bg-[var(--sc-coral)]"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: 'linear' }}
                    />
                  ) : null}
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
            <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.id}
              className="min-w-0"
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: MOTION_EASE }}
            >
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
            </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${active.id}-visual`}
              className="h-[320px] min-w-0 sm:h-[400px] lg:h-[440px]"
              initial={reduceMotion ? false : { opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -16, scale: 0.99 }}
              transition={{ duration: 0.55, ease: MOTION_EASE }}
            >
              {active.screenshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.screenshot.src}
                  alt={active.screenshot.alt}
                  className="h-full w-full rounded-xl border border-[var(--sc-line)] object-cover object-left-top shadow-[0_24px_60px_-28px_rgba(26,23,20,0.35)]"
                />
              ) : (
                active.visual
              )}
            </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </StudioCraftContainer>
    </section>
  );
}
