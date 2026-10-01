'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  METERED_PRICING_PLANS,
  PRICING_CALCULATOR,
  PRICING_INTENTS,
  contactHref,
  formatKes,
  getPricingPlan,
  monthlyPriceKes,
  type PricingPlanId,
} from '@/lib/pricing';

const { minEmployees, maxEmployees, defaultEmployees, enterpriseThreshold, defaultPlanId } =
  PRICING_CALCULATOR;

function clampEmployees(value: number): number {
  if (!Number.isFinite(value)) return minEmployees;
  return Math.min(maxEmployees, Math.max(minEmployees, Math.round(value)));
}

export function PricingCalculator() {
  const [employees, setEmployees] = useState(defaultEmployees);
  const [planId, setPlanId] = useState<PricingPlanId>(defaultPlanId);

  const plan = getPricingPlan(planId);
  const total = monthlyPriceKes(planId, employees) ?? 0;
  const overThreshold = employees > enterpriseThreshold;

  return (
    <section className="mt-12 sm:mt-16" aria-labelledby="pricing-calculator-heading">
      <div className="rounded-[20px] border border-pub-border bg-white p-5 sm:p-8">
        <div className="text-center">
          <h2
            id="pricing-calculator-heading"
            className="font-heading text-[clamp(1.375rem,4vw,1.75rem)] font-extrabold tracking-[-0.02em] text-pub-ink"
          >
            What will it cost us?
          </h2>
          <p className="mx-auto mt-2 max-w-[34rem] text-sm leading-relaxed text-pub-ink-muted">
            Move the slider to your headcount. There is no minimum and no band to fall into.
          </p>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:gap-10">
          <div className="min-w-0">
            <div
              className="flex rounded-full border border-pub-border bg-pub-surface-muted p-1"
              role="radiogroup"
              aria-label="Plan"
            >
              {METERED_PRICING_PLANS.map((option) => {
                const selected = option.id === planId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPlanId(option.id)}
                    className={`min-h-11 flex-1 rounded-full px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pub-primary)]/30 ${
                      selected
                        ? 'bg-pub-ink text-[#FBF8F4]'
                        : 'text-pub-ink-muted hover:text-pub-ink'
                    }`}
                  >
                    <span className="block truncate">{option.name}</span>
                    <span className="block text-[11px] font-medium opacity-70">
                      {formatKes(option.rateKesPerEmployee ?? 0)} / employee
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              <label
                htmlFor="pricing-calculator-employees"
                className="block text-sm font-medium text-pub-ink"
              >
                Active employees
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id="pricing-calculator-employees"
                  type="number"
                  inputMode="numeric"
                  min={minEmployees}
                  max={maxEmployees}
                  value={employees}
                  onChange={(event) => setEmployees(clampEmployees(Number(event.target.value)))}
                  className="h-11 w-24 shrink-0 rounded-xl border border-pub-border bg-white px-3 text-base font-semibold tabular-nums text-pub-ink focus:border-[var(--pub-primary)] focus:outline-none"
                />
                <input
                  type="range"
                  min={minEmployees}
                  max={maxEmployees}
                  step={1}
                  value={employees}
                  onChange={(event) => setEmployees(clampEmployees(Number(event.target.value)))}
                  aria-label="Active employees"
                  className="h-11 min-w-0 flex-1 accent-[var(--pub-primary)]"
                />
              </div>
              <p className="mt-2 flex justify-between text-[11px] text-pub-ink-subtle">
                <span>{minEmployees}</span>
                <span>{maxEmployees}+</span>
              </p>
            </div>
          </div>

          <div className="min-w-0 rounded-[16px] border border-pub-border bg-pub-surface-muted p-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pub-ink-subtle">
              {plan.name}
            </p>
            <p className="mt-2 font-heading text-[clamp(1.5rem,7vw,2rem)] font-extrabold leading-tight tracking-[-0.02em] tabular-nums text-pub-ink">
              {formatKes(total)}
            </p>
            <p className="text-sm text-pub-ink-muted">per month</p>
            <p className="mt-2 text-[13px] leading-relaxed text-pub-ink-subtle">
              {employees} {employees === 1 ? 'employee' : 'employees'} ×{' '}
              {formatKes(plan.rateKesPerEmployee ?? 0)}
            </p>

            {overThreshold ? (
              <div className="mt-4 border-t border-pub-border pt-4 text-[13px] leading-relaxed text-pub-ink-muted">
                <p>At this size, talk to us about Enterprise pricing.</p>
                <Link
                  href={contactHref(PRICING_INTENTS.enterprise)}
                  className="mt-1 inline-flex font-semibold text-[var(--pub-primary)] underline-offset-4 hover:underline"
                >
                  Talk to sales
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
