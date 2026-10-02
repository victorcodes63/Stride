'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from 'motion/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import { Bank, DeviceMobile, FileText, Files, Notebook, UsersThree } from '@phosphor-icons/react';
import { CountUp, MOTION_EASE } from '@/components/marketing/motion';
import { SectionBadge, StudioCraftContainer } from '@/components/marketing/v3/studio-craft-shared';
import { PLATFORM_PAGE } from '@/lib/marketing-config';

/**
 * Example scenario only. Every metric is a count (never a timing), so it stays
 * true however long a real run takes. Visuals show statuses, not shilling amounts.
 */
const TEAM_SIZE = 120;

type Step = {
  key: string;
  label: string;
  title: string;
  body: string;
  metric: number;
  metricLabel: string;
  visual: ReactNode;
};

/* ---------- visuals ---------- */

type IconName = 'users' | 'scale' | 'phone' | 'book' | 'file';

/** Phosphor duotone icons, chosen for the job each card represents. */
const ICONS: Record<IconName, PhosphorIcon> = {
  users: UsersThree,
  scale: Bank,
  phone: DeviceMobile,
  book: Notebook,
  file: Files,
};

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const Component = ICONS[name];
  return <Component size={size} weight="duotone" aria-hidden />;
}

function Check() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden>
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8.5l2.5 2.5L12 5.5" />
      </svg>
    </span>
  );
}

function Pill({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'coral' | 'grey' }) {
  const toneClass =
    tone === 'coral'
      ? 'bg-[var(--sc-coral)]/10 text-[var(--sc-coral-deep)]'
      : tone === 'grey'
        ? 'bg-[var(--sc-paper-2)] text-[var(--sc-ink-muted)]'
        : 'bg-emerald-50 text-emerald-700';
  return <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${toneClass}`}>{children}</span>;
}

/** Clean light product card: icon tile, title + subtitle, then content. */
function Card({
  icon,
  title,
  subtitle,
  aside,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="w-full rounded-[20px] border border-[var(--sc-line)] bg-white p-5 shadow-[0_1px_2px_rgba(26,23,20,0.04),0_24px_60px_-28px_rgba(26,23,20,0.22)] sm:p-7">
      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--sc-coral)]/10 text-[var(--sc-coral)]">
          <Icon name={icon} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold tracking-[-0.01em] text-[var(--sc-ink)]">{title}</p>
          <p className="truncate text-[13px] text-[var(--sc-ink-subtle)]">{subtitle}</p>
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function CheckRow({ label, pill, tone }: { label: string; pill: string; tone?: 'green' | 'coral' | 'grey' }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-3">
      <Check />
      <span className="flex-1 text-[14px] text-[var(--sc-ink)]">{label}</span>
      <Pill tone={tone}>{pill}</Pill>
    </div>
  );
}

const AVATAR_TONES = ['#FF5436', '#1A1714', '#78716C', '#E63E22', '#44403C'];
const AVATAR_INITIALS = ['AN', 'JM', 'FW', 'BO', 'MK'];

function RunVisual() {
  return (
    <Card icon="users" title="September pay run" subtitle={`${TEAM_SIZE} employees · Head office`} aside={<Pill tone="coral">Approved</Pill>}>
      <div className="flex items-center justify-between rounded-2xl bg-[var(--sc-paper-2)] px-4 py-3.5">
        <div className="flex -space-x-2">
          {AVATAR_INITIALS.map((initials, index) => (
            <span
              key={initials}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-[var(--sc-paper-2)]"
              style={{ backgroundColor: AVATAR_TONES[index] }}
            >
              {initials}
            </span>
          ))}
          <span className="flex h-8 items-center justify-center rounded-full bg-white px-2.5 text-[11px] font-semibold text-[var(--sc-ink-muted)] ring-2 ring-[var(--sc-paper-2)]">
            +{TEAM_SIZE - AVATAR_INITIALS.length}
          </span>
        </div>
        <span className="text-[13px] font-medium text-[var(--sc-ink-muted)]">All records active</span>
      </div>
      <div className="mt-3 divide-y divide-[var(--sc-line)]/70">
        <CheckRow label="Leave applied" pill="Synced" />
        <CheckRow label="Attendance & overtime" pill="Synced" />
        <CheckRow label="Allowances & deductions" pill="Synced" />
      </div>
    </Card>
  );
}

function StatutoryVisual() {
  return (
    <Card icon="scale" title="Statutory deductions" subtitle="Applied to every payslip" aside={<Pill>4 of 4</Pill>}>
      <div className="grid grid-cols-2 gap-3">
        {[
          ['PAYE', 'KRA income tax'],
          ['NSSF', 'Pension contribution'],
          ['SHIF', 'Health insurance'],
          ['Housing Levy', 'Affordable housing'],
        ].map(([name, detail]) => (
          <div key={name} className="rounded-2xl border border-[var(--sc-line)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-[var(--sc-ink)]">{name}</span>
              <Check />
            </div>
            <p className="mt-1.5 text-[12.5px] text-[var(--sc-ink-subtle)]">{detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PayoutVisual() {
  const reduceMotion = useReducedMotion();
  return (
    <Card icon="phone" title="M-Pesa bulk payout" subtitle="Salaries · September" aside={<Pill>Sent</Pill>}>
      <div className="rounded-2xl bg-[var(--sc-paper-2)] p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-[var(--sc-ink)]">{TEAM_SIZE}</span>
          <span className="text-[13px] font-medium text-[var(--sc-ink-muted)]">payouts in one batch</span>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
          <motion.div
            className="h-full rounded-full bg-[var(--sc-coral)]"
            initial={{ width: reduceMotion ? '100%' : '6%' }}
            whileInView={{ width: '100%' }}
            viewport={{ once: false, margin: '-20% 0px' }}
            transition={{ duration: 2.2, ease: MOTION_EASE }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[12px] text-[var(--sc-ink-subtle)]">
          <span>Batch submitted</span>
          <span>{TEAM_SIZE} / {TEAM_SIZE} delivered</span>
        </div>
      </div>
      <div className="mt-3">
        <CheckRow label="Reconciled against payroll" pill="Matched" />
      </div>
    </Card>
  );
}

function LedgerVisual() {
  const lines: [string, 'Dr' | 'Cr'][] = [
    ['Salaries & wages', 'Dr'],
    ['PAYE payable', 'Cr'],
    ['NSSF payable', 'Cr'],
    ['SHIF payable', 'Cr'],
    ['Housing Levy payable', 'Cr'],
    ['Net pay clearing', 'Cr'],
  ];
  return (
    <Card icon="book" title="Payroll journal" subtitle="General ledger · auto-posted" aside={<Pill>Posted</Pill>}>
      <div className="overflow-hidden rounded-2xl border border-[var(--sc-line)]">
        <div className="grid grid-cols-[1fr_auto] bg-[var(--sc-paper-2)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sc-ink-subtle)]">
          <span>Account</span>
          <span>Entry</span>
        </div>
        {lines.map(([account, side]) => (
          <div key={account} className="grid grid-cols-[1fr_auto] items-center border-t border-[var(--sc-line)]/70 px-4 py-3">
            <span className={`text-[14px] text-[var(--sc-ink)] ${side === 'Cr' ? 'pl-4' : ''}`}>{account}</span>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                side === 'Dr' ? 'bg-[var(--sc-ink)] text-white' : 'bg-[var(--sc-paper-2)] text-[var(--sc-ink-muted)]'
              }`}
            >
              {side}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FiledVisual() {
  const files: [string, string, 'green' | 'coral'][] = [
    ['Payslips', `${TEAM_SIZE} sent to self-service`, 'green'],
    ['PAYE return', 'Exported for iTax', 'coral'],
    ['Statutory schedules', 'NSSF · SHIF · Housing Levy', 'green'],
  ];
  return (
    <Card icon="file" title="Ready to file" subtitle="September outputs" aside={<Pill>Complete</Pill>}>
      <div className="space-y-2.5">
        {files.map(([name, detail, tone]) => (
          <div key={name} className="flex items-center gap-3.5 rounded-2xl border border-[var(--sc-line)] p-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sc-paper-2)] text-[var(--sc-ink-muted)]">
              <FileText size={19} weight="duotone" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[var(--sc-ink)]">{name}</p>
              <p className="truncate text-[12.5px] text-[var(--sc-ink-subtle)]">{detail}</p>
            </div>
            <Pill tone={tone}>{tone === 'coral' ? 'iTax-ready' : 'Done'}</Pill>
          </div>
        ))}
      </div>
    </Card>
  );
}

const STEPS: readonly Step[] = [
  {
    key: 'run',
    label: 'Payroll run',
    title: 'Run payroll for the whole team.',
    body: 'Leave, attendance and allowances flow in from the same records, so the run starts complete.',
    metric: 1,
    metricLabel: 'run for the whole team',
    visual: <RunVisual />,
  },
  {
    key: 'statutory',
    label: 'Statutory',
    title: 'Every deduction, calculated.',
    body: 'PAYE, NSSF, SHIF and Housing Levy are computed on every payslip under current Kenyan rules.',
    metric: 4,
    metricLabel: 'statutory deductions per payslip',
    visual: <StatutoryVisual />,
  },
  {
    key: 'payout',
    label: 'M-Pesa payout',
    title: 'Pay everyone in one batch.',
    body: 'Salaries go out as a single M-Pesa bulk batch, then reconcile back against the run.',
    metric: 1,
    metricLabel: `bulk batch for all ${TEAM_SIZE} payouts`,
    visual: <PayoutVisual />,
  },
  {
    key: 'ledger',
    label: 'Ledger post',
    title: 'Finance updates itself.',
    body: 'The run posts its journal straight to the ledger: expenses, statutory liabilities and net pay.',
    metric: 0,
    metricLabel: 'lines re-keyed into finance',
    visual: <LedgerVisual />,
  },
  {
    key: 'filed',
    label: 'Ready to file',
    title: 'Payslips out, returns ready.',
    body: 'Employees get payslips in self-service, and your PAYE return is exported ready for iTax.',
    metric: TEAM_SIZE,
    metricLabel: 'payslips issued to employees',
    visual: <FiledVisual />,
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
                    {/* Keyed swap with an entrance only: content never waits on an exit animation. */}
                      <motion.div
                        key={step.key}
                        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, ease: MOTION_EASE }}
                      >
                        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[var(--sc-coral)]">
                          Step {active + 1} — {step.label}
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
                    Step {index + 1} — {item.label}
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
