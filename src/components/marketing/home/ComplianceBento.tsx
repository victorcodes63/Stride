'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Icon } from '@phosphor-icons/react';
import {
  Buildings,
  Check,
  DeviceMobile,
  GlobeHemisphereWest,
  LockSimple,
  Receipt,
  ShieldCheck,
} from '@phosphor-icons/react';
import { animate, motion, useInView, useReducedMotion } from 'motion/react';
import { PLATFORM_COMPLIANCE, PLATFORM_COMPLIANCE_FLOW, PLATFORM_COMPLIANCE_HOMEPAGE } from '@/lib/marketing-config';

// Illustrative figures — replace before publish.
const EMPLOYEE_COUNT = 1240;
const PAYE_TOTAL = 3_842_160;
const NSSF_TOTAL = 1_860_000;
const SHIF_TOTAL = 446_400;
const DISBURSED_COUNT = 1240;

const STEP_MS = 850;
const FINAL_STEP = 4;
const CARD_SPRING = { type: 'spring' as const, stiffness: 150, damping: 20 };
const COUNT_DURATION_S = 0.6;

type ComplianceItem = (typeof PLATFORM_COMPLIANCE)[number];
type CardState = 'idle' | 'active' | 'done';

const COMPLIANCE_ICONS: Record<ComplianceItem['id'], Icon> = {
  paye: Receipt,
  nssf: ShieldCheck,
  mpesa: DeviceMobile,
  'multi-entity': Buildings,
  odpc: LockSimple,
  region: GlobeHemisphereWest,
};

const CARD_ORDER: ComplianceItem['id'][] = [
  'paye',
  'nssf',
  'mpesa',
  'multi-entity',
  'odpc',
  'region',
];

const DESKTOP_PLACEMENT: Record<ComplianceItem['id'], string> = {
  paye: 'lg:col-start-1 lg:col-span-3 lg:row-start-2 lg:row-span-2',
  nssf: 'lg:col-start-4 lg:col-span-3 lg:row-start-2',
  mpesa: 'lg:col-start-4 lg:col-span-3 lg:row-start-3',
  'multi-entity': 'lg:col-start-1 lg:col-span-2 lg:row-start-4',
  odpc: 'lg:col-start-3 lg:col-span-2 lg:row-start-4',
  region: 'lg:col-start-5 lg:col-span-2 lg:row-start-4',
};

const CARD_TRIGGER_STEP: Record<ComplianceItem['id'], number> = {
  paye: 0,
  nssf: 1,
  mpesa: 2,
  'multi-entity': 3,
  odpc: 4,
  region: 4,
};

type ConsoleLine = { step: number; text: string; filed?: boolean };

const CONSOLE_LINES: ConsoleLine[] = [
  { step: 0, text: `› Starting pay run · ${EMPLOYEE_COUNT.toLocaleString()} employees` },
  { step: 1, text: `› Computing PAYE … KES ${PAYE_TOTAL.toLocaleString()} done` },
  { step: 1, text: `› NSSF + SHIF … done` },
  { step: 2, text: `› Disbursing via M-Pesa … ${DISBURSED_COUNT.toLocaleString()} paid` },
  { step: 3, text: '› Posting to ledger … done' },
  { step: 4, text: '✓ FILED — KRA, NSSF, SHIF', filed: true },
];

function getCardState(cardId: ComplianceItem['id'], activeStep: number): CardState {
  const trigger = CARD_TRIGGER_STEP[cardId];
  if (activeStep < trigger) return 'idle';
  if (activeStep === trigger) return 'active';
  return 'done';
}

function usePayRunStepper(reduceMotion: boolean | null) {
  const demoRef = useRef<HTMLDivElement>(null);
  const inView = useInView(demoRef, { once: true, margin: '-20% 0px' });
  const [runId, setRunId] = useState(0);
  const [activeStep, setActiveStep] = useState(reduceMotion ? FINAL_STEP : -1);
  const [isComplete, setIsComplete] = useState(Boolean(reduceMotion));

  const replay = useCallback(() => {
    setRunId((id) => id + 1);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setActiveStep(FINAL_STEP);
      setIsComplete(true);
      return;
    }

    if (!inView) return;

    setActiveStep(0);
    setIsComplete(false);

    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      if (step <= FINAL_STEP) {
        setActiveStep(step);
        if (step === FINAL_STEP) setIsComplete(true);
      } else {
        clearInterval(id);
      }
    }, STEP_MS);

    return () => clearInterval(id);
  }, [inView, reduceMotion, runId]);

  return { demoRef, activeStep, isComplete, replay, reduceMotion: Boolean(reduceMotion) };
}

function formatKes(value: number) {
  return `KES ${Math.round(value).toLocaleString()}`;
}

function CountUpFigure({
  value,
  animateNow,
  reduceMotion,
  className = '',
  format = 'kes',
}: {
  value: number;
  animateNow: boolean;
  reduceMotion: boolean;
  className?: string;
  format?: 'kes' | 'number';
}) {
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    if (!animateNow) {
      setDisplay(0);
      return;
    }
    const controls = animate(0, value, {
      duration: COUNT_DURATION_S,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [animateNow, reduceMotion, value]);

  const formatted =
    format === 'number'
      ? Math.round(display).toLocaleString()
      : formatKes(display);

  return <span className={className}>{formatted}</span>;
}

function PipelineNode({
  label,
  index,
  activeStep,
  reduceMotion,
}: {
  label: string;
  index: number;
  activeStep: number;
  reduceMotion: boolean;
}) {
  const isComplete = activeStep > index;
  const isActive = activeStep === index;

  return (
    <motion.span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors duration-[250ms] ${
        isActive
          ? 'border-[var(--sc-coral)] bg-[var(--sc-coral)] text-white shadow-[0_0_20px_rgba(255,84,54,0.35)]'
          : isComplete
            ? 'border-[var(--sc-ink)] bg-[var(--sc-paper-2)] text-[var(--sc-ink)]'
            : 'border-[var(--sc-line)] bg-[var(--sc-paper-2)] text-[var(--sc-ink-subtle)]'
      }`}
      animate={
        reduceMotion
          ? undefined
          : {
              scale: isActive ? 1.02 : 1,
            }
      }
      transition={{ duration: 0.25 }}
    >
      {isComplete ? (
        <Check size={10} weight="bold" className="shrink-0" aria-hidden />
      ) : null}
      {label}
    </motion.span>
  );
}

function PayRunPipeline({
  activeStep,
  reduceMotion,
}: {
  activeStep: number;
  reduceMotion: boolean;
}) {
  const progress =
    activeStep < 0 ? 0 : activeStep >= FINAL_STEP ? 100 : (activeStep / FINAL_STEP) * 100;

  return (
    <div className="relative rounded-2xl border border-[var(--sc-line)] bg-white p-5">
      <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--sc-ink-subtle)]">
        One pay run, end to end
      </p>

      <div className="relative mt-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {PLATFORM_COMPLIANCE_FLOW.map((step, index) => (
            <span key={step} className="inline-flex items-center gap-2">
              <PipelineNode
                label={step}
                index={index}
                activeStep={activeStep}
                reduceMotion={reduceMotion}
              />
              {index < PLATFORM_COMPLIANCE_FLOW.length - 1 ? (
                <span
                  className="inline-block px-0.5 font-mono text-sm text-[var(--sc-ink-subtle)]"
                  aria-hidden
                >
                  →
                </span>
              ) : null}
            </span>
          ))}
        </div>

        <div
          className="relative mt-4 h-0.5 w-full overflow-hidden rounded-full bg-[var(--sc-line)]"
          aria-hidden
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--sc-coral)]"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.25, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  );
}

function ConsoleLine({ line, visible }: { line: ConsoleLine; visible: boolean }) {
  if (!visible) return null;

  if (line.filed) {
    return (
      <motion.div
        className="mt-2 rounded-lg border border-[var(--sc-coral)]/50 bg-[var(--sc-coral)]/15 px-3 py-2.5"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        role="status"
      >
        <p className="font-mono text-[13px] font-semibold leading-snug tracking-wide text-white sm:text-sm">
          {line.text}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.p
      className="font-mono text-[13px] leading-relaxed text-white/70 sm:text-[13px]"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {line.text}
    </motion.p>
  );
}

function StatusPill({ state }: { state: CardState }) {
  if (state === 'idle') return null;

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
        state === 'active'
          ? 'border-[var(--sc-coral)]/30 bg-[var(--sc-coral)]/10 text-[var(--sc-coral)]'
          : 'border-[var(--sc-coral)]/25 bg-[var(--sc-coral)]/5 text-[var(--sc-coral)]'
      }`}
    >
      {state === 'active' ? 'Running…' : 'Done ✓'}
    </span>
  );
}

function IconChip({
  icon: IconComponent,
  variant,
  done,
}: {
  icon: Icon;
  variant: 'light' | 'dark';
  done?: boolean;
}) {
  const isDark = variant === 'dark';

  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
          isDark
            ? 'border-white/15 bg-white/10 text-white'
            : 'border-[var(--sc-line)] bg-[var(--sc-paper-2)] text-[var(--sc-ink)]'
        }`}
      >
        <IconComponent size={18} weight="regular" aria-hidden />
      </span>
      {done ? (
        <span
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--sc-coral)] bg-[var(--sc-coral)] text-white"
          aria-hidden
        >
          <Check size={10} weight="bold" />
        </span>
      ) : null}
    </span>
  );
}

function CardInlineFigure({
  itemId,
  state,
  activeStep,
  reduceMotion,
}: {
  itemId: ComplianceItem['id'];
  state: CardState;
  activeStep: number;
  reduceMotion: boolean;
}) {
  if (state === 'idle') return null;

  if (itemId === 'nssf') {
    return (
      <p className="mt-3 font-mono text-xs text-[var(--sc-ink-muted)]">
        <CountUpFigure
          value={NSSF_TOTAL}
          animateNow={activeStep >= 1}
          reduceMotion={reduceMotion}
        />
        <span className="text-[var(--sc-ink-subtle)]"> · </span>
        <CountUpFigure
          value={SHIF_TOTAL}
          animateNow={activeStep >= 1}
          reduceMotion={reduceMotion}
        />
      </p>
    );
  }

  if (itemId === 'mpesa') {
    return (
      <p className="mt-3 flex items-center gap-2 font-mono text-xs text-[var(--sc-ink-muted)]">
        <span>
          Disbursed to{' '}
          <CountUpFigure
            value={DISBURSED_COUNT}
            animateNow={activeStep >= 2}
            reduceMotion={reduceMotion}
            format="number"
            className="font-semibold text-[var(--sc-ink)]"
          />
        </span>
        {state === 'done' ? (
          <Check size={14} weight="bold" className="text-[var(--sc-coral)]" aria-hidden />
        ) : null}
      </p>
    );
  }

  if (itemId === 'multi-entity' && state !== 'idle') {
    return (
      <p className="mt-3 font-mono text-xs text-[var(--sc-ink-muted)]">
        Posted to ledger
        {state === 'done' ? (
          <span className="ml-1.5 text-[var(--sc-coral)]" aria-hidden>
            ✓
          </span>
        ) : null}
      </p>
    );
  }

  if ((itemId === 'odpc' || itemId === 'region') && state === 'done') {
    return (
      <p className="mt-3 font-mono text-xs text-[var(--sc-coral)]" aria-hidden>
        ✓
      </p>
    );
  }

  return null;
}

function PayRunConsole({
  activeStep,
  isComplete,
  reduceMotion,
  className = '',
}: {
  activeStep: number;
  isComplete: boolean;
  reduceMotion: boolean;
  className?: string;
}) {
  const state = getCardState('paye', activeStep);
  const isActive = state === 'active';
  const isDone = state === 'done';
  const tagsDone = isComplete && activeStep >= FINAL_STEP;
  const activeShadow = isActive
    ? 'shadow-[0_16px_40px_-16px_rgba(255,84,54,0.28)]'
    : 'shadow-none';
  const borderClass = isActive ? 'border-[var(--sc-coral)]' : 'border-[var(--sc-line)]';

  return (
    <motion.article
      className={`relative flex flex-col rounded-2xl border bg-[var(--sc-ink)] p-7 transition-[box-shadow,border-color] duration-300 ${borderClass} ${activeShadow} ${className}`}
      animate={reduceMotion ? undefined : { y: isActive ? -3 : 0 }}
      transition={CARD_SPRING}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--sc-coral)]">Live pay run</p>
        <div className="flex shrink-0 items-center gap-2">
          {isComplete ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--sc-coral)] bg-[var(--sc-coral)]/15 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-[var(--sc-coral)]">
              <Check size={11} weight="bold" aria-hidden />
              Filed
            </span>
          ) : (
            <>
              <StatusPill state={state} />
              <IconChip icon={Receipt} variant="dark" done={isDone} />
            </>
          )}
        </div>
      </div>

      <h3 className="mt-4 font-heading text-2xl font-bold tracking-[-0.02em] text-white">
        KRA PAYE · NSSF · SHIF
      </h3>
      <p className="sr-only">PAYE calculations, payslips, P9s and filing-ready exports</p>

      <div className="mt-4 min-h-[9.5rem] space-y-1.5">
        {reduceMotion
          ? CONSOLE_LINES.map((line) =>
              line.filed ? (
                <div
                  key={line.text}
                  className="mt-2 rounded-lg border border-[var(--sc-coral)]/50 bg-[var(--sc-coral)]/15 px-3 py-2.5"
                  role="status"
                >
                  <p className="font-mono text-[13px] font-semibold leading-snug tracking-wide text-white sm:text-sm">
                    {line.text}
                  </p>
                </div>
              ) : (
                <p key={line.text} className="font-mono text-[13px] leading-relaxed text-white/70">
                  {line.text}
                </p>
              ),
            )
          : CONSOLE_LINES.map((line) => (
              <ConsoleLine key={line.text} line={line} visible={activeStep >= line.step} />
            ))}
      </div>

      {isComplete ? (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
          {['KRA', 'NSSF', 'SHIF'].map((chip) => (
            <span
              key={chip}
              className="rounded-md border border-[var(--sc-coral)]/40 bg-[var(--sc-coral)]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--sc-coral)]"
            >
              {chip} done
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-1.5 pt-6" aria-hidden>
        {['PAYE', 'P9', 'iTax'].map((tag) => (
          <span
            key={tag}
            className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
              tagsDone
                ? 'border-[var(--sc-coral)]/35 bg-[var(--sc-coral)]/10 text-[var(--sc-coral)]'
                : 'border-white/15 bg-white/5 text-white/80'
            }`}
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.article>
  );
}

type HomeComplianceItem = (typeof PLATFORM_COMPLIANCE_HOMEPAGE)[number];

const HOME_COMPLIANCE_ICONS: Record<HomeComplianceItem['id'], Icon> = {
  statutory: ShieldCheck,
  mpesa: DeviceMobile,
  'multi-region': GlobeHemisphereWest,
};

function ComplianceHomeCard({ item }: { item: HomeComplianceItem }) {
  const IconComponent = HOME_COMPLIANCE_ICONS[item.id];

  return (
    <article className="flex h-full flex-col rounded-2xl border border-[var(--sc-line)] bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--sc-coral)]">
          {item.category}
        </p>
        <IconChip icon={IconComponent} variant="light" />
      </div>
      <h3 className="mt-4 font-heading text-xl font-bold tracking-[-0.02em] text-[var(--sc-ink)]">
        {item.label}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--sc-ink-muted)]">{item.detail}</p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-6">
        {item.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-[var(--sc-line)] bg-[var(--sc-paper-2)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--sc-ink-muted)]"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}

type ComplianceCardProps = {
  item: ComplianceItem;
  index: number;
  activeStep: number;
  isComplete: boolean;
  reduceMotion: boolean;
  className?: string;
};

function ComplianceCard({
  item,
  index,
  activeStep,
  isComplete,
  reduceMotion,
  className = '',
}: ComplianceCardProps) {
  const IconComponent = COMPLIANCE_ICONS[item.id];
  const isHero = 'featured' in item && item.featured;
  const indexLabel = String(index + 1).padStart(2, '0');
  const state = getCardState(item.id, activeStep);
  const isActive = state === 'active';
  const isDone = state === 'done';
  const tagsDone = isComplete && activeStep >= FINAL_STEP;

  const activeShadow = isActive
    ? 'shadow-[0_16px_40px_-16px_rgba(255,84,54,0.28)]'
    : isHero
      ? 'shadow-none'
      : 'shadow-none';

  const borderClass = isActive
    ? 'border-[var(--sc-coral)]'
    : 'border-[var(--sc-line)]';

  if (isHero) {
    const visibleLines = CONSOLE_LINES.filter((line) => activeStep >= line.step);

    return (
      <motion.article
        className={`relative flex h-full min-h-0 flex-col rounded-2xl border bg-[var(--sc-ink)] p-7 transition-[box-shadow,border-color] duration-300 ${borderClass} ${activeShadow} ${className}`}
        animate={reduceMotion ? undefined : { y: isActive ? -3 : 0 }}
        transition={CARD_SPRING}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--sc-coral)]">
            {item.category}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {isComplete ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--sc-coral)] bg-[var(--sc-coral)]/15 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-[var(--sc-coral)]">
                <Check size={11} weight="bold" aria-hidden />
                Filed
              </span>
            ) : (
              <>
                <StatusPill state={state} />
                <IconChip icon={IconComponent} variant="dark" done={isDone} />
              </>
            )}
          </div>
        </div>

        <h3 className="mt-4 font-heading text-2xl font-bold tracking-[-0.02em] text-white">
          {item.label}
        </h3>
        <p className="sr-only">{item.detail}</p>

        <div className="mt-4 min-h-[9.5rem] space-y-1.5">
          {reduceMotion
            ? CONSOLE_LINES.map((line) =>
                line.filed ? (
                  <div
                    key={line.text}
                    className="mt-2 rounded-lg border border-[var(--sc-coral)]/50 bg-[var(--sc-coral)]/15 px-3 py-2.5"
                    role="status"
                  >
                    <p className="font-mono text-[13px] font-semibold leading-snug tracking-wide text-white sm:text-sm">
                      {line.text}
                    </p>
                  </div>
                ) : (
                  <p key={line.text} className="font-mono text-[13px] leading-relaxed text-white/70">
                    {line.text}
                  </p>
                ),
              )
            : CONSOLE_LINES.map((line) => (
                <ConsoleLine
                  key={line.text}
                  line={line}
                  visible={activeStep >= line.step}
                />
              ))}
        </div>

        {isComplete ? (
          <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
            {['KRA', 'NSSF', 'SHIF'].map((chip) => (
              <span
                key={chip}
                className="rounded-md border border-[var(--sc-coral)]/40 bg-[var(--sc-coral)]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--sc-coral)]"
              >
                {chip} done
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-6">
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                  tagsDone
                    ? 'border-[var(--sc-coral)]/35 bg-[var(--sc-coral)]/10 text-[var(--sc-coral)]'
                    : 'border-white/15 bg-white/5 text-white/80'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
          <span className="shrink-0 font-mono text-xs text-white/40">{indexLabel}</span>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      className={`flex h-full min-h-0 flex-col rounded-2xl border bg-white p-6 transition-[box-shadow,border-color] duration-300 ${borderClass} ${activeShadow} ${className}`}
      animate={reduceMotion ? undefined : { y: isActive ? -3 : 0 }}
      transition={CARD_SPRING}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--sc-coral)]">
          {item.category}
        </p>
        <div className="flex items-center gap-2">
          <StatusPill state={state} />
          <IconChip icon={IconComponent} variant="light" done={isDone} />
        </div>
      </div>

      <h3 className="mt-4 font-heading text-xl font-bold tracking-[-0.02em] text-[var(--sc-ink)]">
        {item.label}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--sc-ink-muted)]">{item.detail}</p>

      <CardInlineFigure
        itemId={item.id}
        state={state}
        activeStep={activeStep}
        reduceMotion={reduceMotion}
      />

      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className={`rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                isDone
                  ? 'border-[var(--sc-coral)]/25 bg-[var(--sc-coral)]/5 text-[var(--sc-coral)]'
                  : 'border-[var(--sc-line)] bg-[var(--sc-paper-2)] text-[var(--sc-ink-muted)]'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
        <span className="shrink-0 font-mono text-xs text-[var(--sc-ink-subtle)]">{indexLabel}</span>
      </div>
    </motion.article>
  );
}

type ComplianceBentoProps = {
  showFlowStrip?: boolean;
  variant?: 'full' | 'homepage';
  className?: string;
};

export function ComplianceBento({
  showFlowStrip = true,
  variant = 'full',
  className = '',
}: ComplianceBentoProps) {
  const reduceMotionPref = useReducedMotion();
  const { demoRef, activeStep, isComplete, replay, reduceMotion } =
    usePayRunStepper(reduceMotionPref);

  if (variant === 'homepage') {
    return (
      <div
        ref={demoRef}
        role="region"
        aria-label="Demonstration: a Kenyan pay run executing end to end"
        className={className}
      >
        <PayRunPipeline activeStep={activeStep} reduceMotion={reduceMotion} />
        <PayRunConsole
          activeStep={activeStep}
          isComplete={isComplete}
          reduceMotion={reduceMotion}
          className="mt-4"
        />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {PLATFORM_COMPLIANCE_HOMEPAGE.map((item) => (
            <ComplianceHomeCard key={item.id} item={item} />
          ))}
        </div>

        {!reduceMotion ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={replay}
              className="rounded-full border border-[var(--sc-line)] bg-white px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-[var(--sc-ink-muted)] transition-colors hover:border-[var(--sc-coral)] hover:text-[var(--sc-coral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-coral)]/30 focus-visible:ring-offset-2"
              aria-label="Replay pay run demonstration"
            >
              Replay
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const orderedCards = CARD_ORDER.map((id) => {
    const index = PLATFORM_COMPLIANCE.findIndex((item) => item.id === id);
    return { item: PLATFORM_COMPLIANCE[index], index };
  });

  return (
    <div
      ref={demoRef}
      role="region"
      aria-label="Demonstration: a Kenyan pay run executing end to end"
      className={className}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6 lg:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-stretch">
        {showFlowStrip ? (
          <div className="md:col-span-2 lg:col-span-6 lg:row-start-1">
            <PayRunPipeline activeStep={activeStep} reduceMotion={reduceMotion} />
          </div>
        ) : null}

        {orderedCards.map(({ item, index }) => (
          <div
            key={item.id}
            className={`flex min-h-0 ${
              item.id === 'paye' ? 'md:col-span-2' : 'md:col-span-1'
            } ${DESKTOP_PLACEMENT[item.id]}`}
          >
            <ComplianceCard
              item={item}
              index={index}
              activeStep={activeStep}
              isComplete={isComplete}
              reduceMotion={reduceMotion}
              className="w-full"
            />
          </div>
        ))}
      </div>

      {!reduceMotion ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={replay}
            className="rounded-full border border-[var(--sc-line)] bg-white px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-[var(--sc-ink-muted)] transition-colors hover:border-[var(--sc-coral)] hover:text-[var(--sc-coral)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sc-coral)]/30 focus-visible:ring-offset-2"
            aria-label="Replay pay run demonstration"
          >
            Replay
          </button>
        </div>
      ) : null}
    </div>
  );
}
