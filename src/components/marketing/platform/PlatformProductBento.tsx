'use client';

import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle, Clock, Fingerprint, Buildings, UsersThree, Files } from '@phosphor-icons/react';
import { CountUp, MOTION_EASE } from '@/components/marketing/motion';
import { PLATFORM_MODULES } from '@/lib/marketing-config';

/**
 * A bento of product widgets for an illustrative 120-person team.
 * Statuses and counts only — never money, never invented customer stats.
 */

const TEAM = 120;
const RUN = { approved: 112, pending: 6, flagged: 2 } as const;

const CARD =
  'rounded-[22px] border border-[var(--sc-line)] bg-white shadow-[0_1px_2px_rgba(26,23,20,0.04),0_24px_60px_-34px_rgba(26,23,20,0.22)]';

const STATUTORY = [
  { label: 'PAYE', detail: 'KRA iTax', done: true },
  { label: 'NSSF', detail: 'Pension contribution', done: true },
  { label: 'SHIF', detail: 'Health insurance', done: false },
  { label: 'Housing Levy', detail: 'Affordable housing', done: false },
] as const;

const ENTITIES = [
  { name: 'Head office', country: 'Kenya', currency: 'KES', staff: 96 },
  { name: 'Branch', country: 'Uganda', currency: 'UGX', staff: 24 },
] as const;

const WEEK = [
  { day: 'Mon', present: 116 },
  { day: 'Tue', present: 114 },
  { day: 'Wed', present: 117 },
  { day: 'Thu', present: 112 },
  { day: 'Fri', present: 109 },
] as const;

const WORKS_WITH = [
  'M-Pesa bulk payouts',
  'KRA iTax exports',
  'P9 certificates',
  'NSSF & SHIF returns',
  'Bank transfer files',
  'Excel & CSV import',
  'Biometric clock-in',
  'Employee self-service',
] as const;

/** Example tenant: the two core areas plus two live plug-ins. */
const SWITCHED_ON = new Set(
  ['HR & Payroll', 'Finance', 'Fleet & Logistics', 'Projects'].filter((name) =>
    PLATFORM_MODULES.some((area) => area.name === name),
  ),
);

function WidgetHead({ title, sub, onInk = false }: { title: string; sub: string; onInk?: boolean }) {
  return (
    <div>
      <p className={`text-[15px] font-semibold ${onInk ? 'text-white' : 'text-[var(--sc-ink)]'}`}>{title}</p>
      <p className={`mt-0.5 text-[13px] ${onInk ? 'text-white/50' : 'text-[var(--sc-ink-subtle)]'}`}>{sub}</p>
    </div>
  );
}

export function PlatformProductBento() {
  const reduceMotion = useReducedMotion();
  const grow = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { scaleX: 0 },
          whileInView: { scaleX: 1 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 1, delay, ease: MOTION_EASE },
        };
  const rise = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { scaleY: 0 },
          whileInView: { scaleY: 1 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.9, delay, ease: MOTION_EASE },
        };

  const segments = [
    { key: 'approved', label: 'Approved', count: RUN.approved, bar: 'bg-[var(--sc-coral)]', dot: 'bg-[var(--sc-coral)]' },
    { key: 'pending', label: 'Awaiting approval', count: RUN.pending, bar: 'bg-white/60', dot: 'bg-white/60' },
    { key: 'flagged', label: 'Flagged for review', count: RUN.flagged, bar: 'bg-amber-400', dot: 'bg-amber-400' },
  ];
  const maxPresent = TEAM;

  return (
    <div className="grid gap-3 lg:grid-cols-12">
      {/* Pay run status */}
      <article className="sc-on-ink relative overflow-hidden rounded-[22px] bg-[var(--sc-ink)] p-7 text-white shadow-[0_30px_70px_-36px_rgba(26,23,20,0.7)] sm:p-8 lg:col-span-7">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(255,84,54,0.28),transparent)]"
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-4">
          <WidgetHead title="September pay run" sub={`${TEAM} employees · 2 entities`} onInk />
          <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white">In review</span>
        </div>

        <div className="relative mt-10 flex items-end gap-3">
          <span className="text-[clamp(3.5rem,7vw,5.5rem)] font-medium leading-[0.85] tracking-[-0.05em]">
            <CountUp value={Math.round((RUN.approved / TEAM) * 100)} duration={1.4} />%
          </span>
          <span className="pb-2 text-[14px] text-white/55">of payslips approved</span>
        </div>

        <div className="relative mt-8 flex h-3 gap-1 overflow-hidden rounded-full">
          {segments.map((s, i) => (
            <motion.span
              key={s.key}
              className={`h-full origin-left rounded-full ${s.bar}`}
              style={{ width: `${(s.count / TEAM) * 100}%` }}
              {...grow(0.1 + i * 0.15)}
            />
          ))}
        </div>

        <dl className="relative mt-7 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
          {segments.map((s) => (
            <div key={s.key}>
              <dt className="flex items-center gap-2 text-[13px] text-white/55">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
                {s.label}
              </dt>
              <dd className="mt-2 text-[26px] font-medium leading-none tracking-[-0.03em] text-white">
                <CountUp value={s.count} duration={1.2} />
              </dd>
            </div>
          ))}
        </dl>
      </article>

      {/* Statutory */}
      <article className={`${CARD} flex flex-col p-7 sm:p-8 lg:col-span-5`}>
        <div className="flex items-start justify-between gap-4">
          <WidgetHead title="Statutory returns" sub="September · every payslip" />
          <span className="rounded-full bg-[var(--sc-coral)]/10 px-3 py-1 text-[12px] font-semibold text-[var(--sc-coral-deep)]">
            2 of 4 filed
          </span>
        </div>
        <ul className="mt-7 divide-y divide-[var(--sc-line)]">
          {STATUTORY.map((item) => (
            <li key={item.label} className="flex items-center gap-3 py-3.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${
                  item.done ? 'bg-emerald-50 text-emerald-600' : 'bg-[var(--sc-paper-2)] text-[var(--sc-ink-subtle)]'
                }`}
              >
                {item.done ? <CheckCircle size={18} weight="fill" aria-hidden /> : <Clock size={18} weight="duotone" aria-hidden />}
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-medium text-[var(--sc-ink)]">{item.label}</span>
                <span className="block text-[12px] text-[var(--sc-ink-subtle)]">{item.detail}</span>
              </span>
              <span className={`text-[13px] font-semibold ${item.done ? 'text-emerald-700' : 'text-[var(--sc-ink-muted)]'}`}>
                {item.done ? 'Filed' : 'Ready to file'}
              </span>
            </li>
          ))}
        </ul>
      </article>

      {/* Entities */}
      <article className={`${CARD} flex flex-col p-7 lg:col-span-4`}>
        <div className="flex items-start justify-between gap-4">
          <WidgetHead title="Entities" sub="One account, two countries" />
          <Buildings size={22} weight="duotone" aria-hidden className="text-[var(--sc-coral)]" />
        </div>
        <div className="mt-6 grid gap-2">
          {ENTITIES.map((entity) => (
            <div key={entity.country} className="flex items-center justify-between rounded-[14px] bg-[var(--sc-paper-2)] px-4 py-3.5">
              <div>
                <p className="text-[15px] font-medium text-[var(--sc-ink)]">{entity.country}</p>
                <p className="text-[12px] text-[var(--sc-ink-subtle)]">
                  {entity.name} · {entity.staff} staff
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-[var(--sc-line)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--sc-ink-muted)]">
                  {entity.currency}
                </span>
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                  Synced
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-auto pt-5 text-[13px] text-[var(--sc-ink-subtle)]">Shared employee records and approvals across both.</p>
      </article>

      {/* Attendance */}
      <article className={`${CARD} flex flex-col p-7 lg:col-span-4`}>
        <div className="flex items-start justify-between gap-4">
          <WidgetHead title="Clock-ins this week" sub={`Present out of ${TEAM}`} />
          <Fingerprint size={22} weight="duotone" aria-hidden className="text-[var(--sc-coral)]" />
        </div>
        <div className="mt-6 flex h-36 items-end gap-2.5">
          {WEEK.map((d, i) => {
            const last = i === WEEK.length - 1;
            return (
              <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className={`text-[12px] font-semibold ${last ? 'text-[var(--sc-coral)]' : 'text-[var(--sc-ink-muted)]'}`}>
                  {d.present}
                </span>
                <motion.span
                  className={`w-full origin-bottom rounded-[8px] ${last ? 'bg-[var(--sc-coral)]' : 'bg-[rgba(255,84,54,0.16)]'}`}
                  style={{ height: `${(d.present / maxPresent) * 72}%` }}
                  {...rise(0.08 * i)}
                />
                <span className="text-[12px] text-[var(--sc-ink-subtle)]">{d.day}</span>
              </div>
            );
          })}
        </div>
      </article>

      {/* Modules switched on */}
      <article className="sc-on-ink flex flex-col rounded-[22px] bg-[var(--sc-coral)] p-7 text-white shadow-[0_30px_70px_-36px_rgba(230,62,34,0.7)] lg:col-span-4">
        <div className="flex items-start justify-between gap-4">
          <WidgetHead title="Modules switched on" sub="Add or remove any time" onInk />
          <UsersThree size={22} weight="duotone" aria-hidden className="text-white" />
        </div>
        <p className="mt-5 text-[64px] font-medium leading-none tracking-[-0.05em]">
          <CountUp value={SWITCHED_ON.size} duration={1.2} />
          <span className="text-white/50">/{PLATFORM_MODULES.length}</span>
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-6">
          {PLATFORM_MODULES.map((area) => {
            const on = SWITCHED_ON.has(area.name);
            return (
              <span
                key={area.name}
                className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${
                  on ? 'bg-white text-[var(--sc-coral-deep)]' : 'bg-white/12 text-white/70'
                }`}
              >
                {area.name}
              </span>
            );
          })}
        </div>
      </article>

      {/* Works with */}
      <article className={`${CARD} flex flex-col gap-5 p-7 lg:col-span-12 lg:flex-row lg:items-center lg:gap-10`}>
        <div className="flex shrink-0 items-center gap-3 lg:w-[220px]">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--sc-coral)]/10 text-[var(--sc-coral)]">
            <Files size={20} weight="duotone" aria-hidden />
          </span>
          <WidgetHead title="Works with" sub="Rails and files you already use" />
        </div>
        <ul className="flex flex-wrap gap-2">
          {WORKS_WITH.map((item) => (
            <li
              key={item}
              className="rounded-full border border-[var(--sc-line)] bg-[var(--sc-paper-2)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--sc-ink)]"
            >
              {item}
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}
