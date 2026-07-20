'use client';

import { CalendarDays, PartyPopper } from 'lucide-react';
import { EssOnboardingProgress } from '@/components/ess/EssOnboardingProgress';

type Props = {
  firstName: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  organizationName: string | null;
  dateOfJoining: string | null;
  countdownDays: number | null;
  percent: number;
  completed: number;
  total: number;
};

function countdownLabel(countdownDays: number | null, dateOfJoining: string | null) {
  if (countdownDays === null) {
    return { headline: 'Your start date is being confirmed', detail: null as string | null };
  }
  const dateText = dateOfJoining
    ? new Date(dateOfJoining).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : null;

  if (countdownDays > 1) {
    return { headline: `Starts in ${countdownDays} days`, detail: dateText };
  }
  if (countdownDays === 1) {
    return { headline: 'Starts tomorrow', detail: dateText };
  }
  if (countdownDays === 0) {
    return { headline: 'Today is your first day', detail: dateText };
  }
  const daysAgo = Math.abs(countdownDays);
  return {
    headline: `You started ${daysAgo} ${daysAgo === 1 ? 'day' : 'days'} ago`,
    detail: dateText,
  };
}

export function EssOnboardingHero({
  firstName,
  jobTitle,
  departmentName,
  organizationName,
  dateOfJoining,
  countdownDays,
  percent,
  completed,
  total,
}: Props) {
  const role = [jobTitle, departmentName].filter(Boolean).join(' · ');
  const { headline, detail } = countdownLabel(countdownDays, dateOfJoining);

  return (
    <section className="ess-today-card relative -mt-3 overflow-hidden rounded-[1.5rem] p-5 text-white">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-14 left-12 h-32 w-32 rounded-full bg-black/10" />

      <div className="relative">
        <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-white/75">
          <PartyPopper className="h-3.5 w-3.5" />
          {organizationName ? `Welcome to ${organizationName}` : 'Welcome aboard'}
        </p>

        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-black leading-tight text-white">
              Welcome, {firstName?.trim() || 'new joiner'}
            </h1>
            {role ? <p className="mt-1 text-sm font-medium text-white/85">{role}</p> : null}
          </div>

          <EssOnboardingProgress percent={percent} variant="onHero" size={82} stroke={8}>
            <span className="text-lg font-black leading-none text-white">{Math.max(0, Math.min(100, Math.round(percent)))}%</span>
            <span className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-white/70">done</span>
          </EssOnboardingProgress>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/15 pt-4 text-sm text-white/85">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <CalendarDays className="h-4 w-4" />
            {headline}
          </span>
          {detail ? <span className="text-white/70">{detail}</span> : null}
        </div>

        <p className="mt-2 text-sm text-white/75">
          {total > 0
            ? `${completed} of ${total} onboarding ${total === 1 ? 'step' : 'steps'} complete`
            : 'Your onboarding checklist is on its way.'}
        </p>
      </div>
    </section>
  );
}
