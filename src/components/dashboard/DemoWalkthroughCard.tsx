'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Map } from 'lucide-react';

import { DEMO_WALKTHROUGH_STEPS } from '@/lib/demo-walkthrough';
import {
  DEMO_ADMIN_EMAIL,
  DEMO_ESS_EMAIL,
  DEMO_FINANCE_EMAIL,
  DEMO_HR_EMAIL,
} from '@/lib/demo-credentials';
import { MARKETING_ROUTES } from '@/lib/marketing-config';

const PERSONA_LABEL: Record<NonNullable<(typeof DEMO_WALKTHROUGH_STEPS)[number]['persona']>, string> = {
  admin: 'Admin',
  hr: 'HR',
  finance: 'Finance',
  ess: 'ESS employee',
};

const PERSONA_EMAIL: Record<keyof typeof PERSONA_LABEL, string> = {
  admin: DEMO_ADMIN_EMAIL,
  hr: DEMO_HR_EMAIL,
  finance: DEMO_FINANCE_EMAIL,
  ess: DEMO_ESS_EMAIL,
};

const STORAGE_KEY = 'stride_demo_walkthrough_done';

export function DemoWalkthroughCard() {
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  const completedCount = useMemo(
    () => DEMO_WALKTHROUGH_STEPS.filter((s) => done[s.id]).length,
    [done],
  );

  function toggleStep(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <section className="dashboard-panel mb-6 overflow-hidden border border-primary-200/60 bg-primary-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Map className="h-4 w-4 shrink-0 text-primary-700" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary-900">Demo walkthrough</p>
            <p className="text-xs text-primary-800/80 truncate">
              {completedCount}/{DEMO_WALKTHROUGH_STEPS.length} steps ·{' '}
              <Link href={MARKETING_ROUTES.demoAccess} className="underline-offset-2 hover:underline">
                demo accounts
              </Link>
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-primary-700" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-primary-700" />
        )}
      </button>

      {open ? (
        <ol className="border-t border-primary-200/50 px-3 py-3 sm:px-4 space-y-1">
          {DEMO_WALKTHROUGH_STEPS.map((step, index) => {
            const isDone = Boolean(done[step.id]);
            const persona = step.persona;
            return (
              <li
                key={step.id}
                className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-primary-100/50"
              >
                <button
                  type="button"
                  onClick={() => toggleStep(step.id)}
                  className="mt-0.5 shrink-0 text-primary-700"
                  aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-700/70">
                      {index + 1}
                    </span>
                    <Link href={step.href} className="text-sm font-medium text-primary-900 hover:underline">
                      {step.title}
                    </Link>
                    {step.minutes ? (
                      <span className="text-[10px] text-primary-800/60">~{step.minutes} min</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-primary-900/75 mt-0.5">{step.description}</p>
                  {persona ? (
                    <p className="text-[11px] text-primary-800/65 mt-1">
                      As {PERSONA_LABEL[persona]}:{' '}
                      <span className="font-mono">{PERSONA_EMAIL[persona]}</span>
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
