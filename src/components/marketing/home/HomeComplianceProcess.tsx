'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from 'motion/react';
import { CountUp, MOTION_EASE } from '@/components/marketing/motion';
import {
  ProductComplianceFiledSlice,
  ProductComplianceLedgerSlice,
  ProductCompliancePayoutSlice,
  ProductComplianceRunSlice,
  ProductComplianceStatutorySlice,
} from '@/components/marketing/product/ProductSlices';
import { DEMO_TEAM_SIZE } from '@/components/marketing/product/demo-tenant';
import { SectionBadge, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { PLATFORM_PAGE } from '@/lib/marketing-config';

/**
 * Example scenario only. Every metric is a count (never a timing), so it stays
 * true however long a real run takes. Visuals show statuses, not shilling amounts.
 */
const TEAM_SIZE = DEMO_TEAM_SIZE;

type Step = {
  key: string;
  label: string;
  title: string;
  body: string;
  metric: number;
  metricLabel: string;
  visual: ReactNode;
};

const STEPS: readonly Step[] = [
  {
    key: 'run',
    label: 'Payroll run',
    title: 'Run payroll for the whole team.',
    body: 'Leave, attendance and allowances flow in from the same records, so the run starts complete.',
    metric: 1,
    metricLabel: 'run for the whole team',
    visual: <ProductComplianceRunSlice />,
  },
  {
    key: 'statutory',
    label: 'Statutory',
    title: 'Every deduction, calculated.',
    body: 'PAYE, NSSF, SHIF and Housing Levy are computed on every payslip under current Kenyan rules.',
    metric: 4,
    metricLabel: 'statutory deductions per payslip',
    visual: <ProductComplianceStatutorySlice />,
  },
  {
    key: 'payout',
    label: 'M-Pesa payout',
    title: 'Pay everyone in one batch.',
    body: 'Salaries go out as a single M-Pesa bulk batch, then reconcile back against the run.',
    metric: 1,
    metricLabel: `bulk batch for all ${TEAM_SIZE} payouts`,
    visual: <ProductCompliancePayoutSlice />,
  },
  {
    key: 'ledger',
    label: 'Ledger post',
    title: 'Finance updates itself.',
    body: 'The run posts its journal straight to the ledger: expenses, statutory liabilities and net pay.',
    metric: 0,
    metricLabel: 'lines re-keyed into finance',
    visual: <ProductComplianceLedgerSlice />,
  },
  {
    key: 'filed',
    label: 'Ready to file',
    title: 'Payslips out, returns ready.',
    body: 'Employees get payslips in self-service, and your PAYE return is exported ready for iTax.',
    metric: TEAM_SIZE,
    metricLabel: 'payslips issued to employees',
    visual: <ProductComplianceFiledSlice />,
  },
];

/* ---------- section ---------- */

export function HomeComplianceProcess() {
  const { compliance } = PLATFORM_PAGE;
  const stepsRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({ target: stepsRef, offset: ['start 55%', 'end 55%'] });
  const rail = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });

  // Active step = the visual panel closest to 55% of the viewport. Plain scroll
  // events, so it stays correct even when animation frames are throttled.
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const target = window.innerHeight * 0.55;
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      panelRefs.current.forEach((panel, index) => {
        if (!panel) return;
        const rect = panel.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - target);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      setActive((current) => (current === best ? current : best));
    };
    const onScroll = () => {
      if (!frame) frame = window.setTimeout(update, 50);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.clearTimeout(frame);
    };
  }, []);

  const step = STEPS[active]!;

  return (
    <section className="bg-white py-24 sm:py-28 lg:py-36" aria-labelledby="compliance-heading">
      <StudioCraftContainer>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-end lg:gap-16">
          <div>
            <SectionBadge label={compliance.badge} />
            <h2
              id="compliance-heading"
              className="max-w-[720px] text-[clamp(2.25rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.03em] text-[var(--sc-ink)]"
            >
              Compliance is not <span className="text-[var(--sc-coral)]">an add-on.</span>
            </h2>
          </div>
          <div>
            <p className="text-[16px] leading-[1.7] text-[var(--sc-ink-muted)]">{compliance.body}</p>
            <p className="mt-4 inline-flex rounded-full bg-[var(--sc-paper-2)] px-3 py-1 text-[13px] font-medium text-[var(--sc-ink-muted)]">
              Example: one month&apos;s pay run for a {TEAM_SIZE}-person team
            </p>
          </div>
        </div>

        <div className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          {/* Pinned narrative (desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-[calc(var(--nav-h)+4rem)]">
              <div className="flex gap-8">
                {/* Progress rail */}
                <div className="relative w-px shrink-0 bg-[var(--sc-line)]" aria-hidden>
                  <motion.div
                    className="absolute inset-x-0 top-0 origin-top bg-[var(--sc-coral)]"
                    style={{ scaleY: reduceMotion ? 1 : rail, height: '100%' }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <ol className="space-y-3">
                    {STEPS.map((item, index) => (
                      <li
                        key={item.key}
                        className={`flex items-center gap-4 text-[15px] transition-colors duration-300 ${
                          index === active ? 'text-[var(--sc-ink)]' : 'text-[var(--sc-ink-subtle)]'
                        }`}
                      >
                        <span className="w-6 font-mono text-[12px]">{String(index + 1).padStart(2, '0')}</span>
                        <span className={index === active ? 'font-semibold' : 'font-medium'}>{item.label}</span>
                        {index < active ? (
                          <span className="text-[var(--sc-coral)]" aria-hidden>
                            ✓
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>

                  <div className="mt-12 min-h-[300px]">
                    <motion.div
                      key={step.key}
                      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease: MOTION_EASE }}
                    >
                      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--sc-coral)]">
                        Step {active + 1}: {step.label}
                      </p>
                      <h3 className="mt-4 text-[clamp(1.75rem,2.6vw,2.375rem)] font-medium leading-[1.12] tracking-[-0.03em] text-[var(--sc-ink)]">
                        {step.title}
                      </h3>
                      <p className="mt-4 max-w-[30rem] text-[16px] leading-[1.7] text-[var(--sc-ink-muted)]">
                        {step.body}
                      </p>
                      <div className="mt-8 flex items-baseline gap-4 border-t border-[var(--sc-line)] pt-6">
                        <span className="text-[clamp(3rem,5vw,4.5rem)] font-medium leading-none tracking-[-0.04em] text-[var(--sc-ink)]">
                          <CountUp value={step.metric} duration={1.1} />
                        </span>
                        <span className="max-w-[14rem] text-[14px] leading-snug text-[var(--sc-ink-muted)]">
                          {step.metricLabel}
                        </span>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scrolling visuals; on mobile each carries its own copy. */}
          <div ref={stepsRef} className="space-y-8 lg:space-y-0">
            {STEPS.map((item, index) => (
              <div
                key={item.key}
                ref={(node) => {
                  panelRefs.current[index] = node;
                }}
                className="flex min-h-0 flex-col justify-center lg:min-h-[78vh]"
              >
                <div className="mb-6 lg:hidden">
                  <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--sc-coral)]">
                    Step {index + 1}: {item.label}
                  </p>
                  <h3 className="mt-3 text-[1.625rem] font-medium leading-tight tracking-[-0.025em] text-[var(--sc-ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.7] text-[var(--sc-ink-muted)]">{item.body}</p>
                  <p className="mt-4 text-[14px] text-[var(--sc-ink-muted)]">
                    <span className="mr-2 text-[28px] font-medium tracking-[-0.03em] text-[var(--sc-ink)]">
                      {item.metric}
                    </span>
                    {item.metricLabel}
                  </p>
                </div>
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0.35, scale: 0.96 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ margin: '-30% 0px -30% 0px' }}
                  transition={{ duration: 0.6, ease: MOTION_EASE }}
                >
                  {item.visual}
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </StudioCraftContainer>
    </section>
  );
}
