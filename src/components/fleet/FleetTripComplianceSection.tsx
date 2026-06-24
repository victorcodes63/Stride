'use client';

import { useState } from 'react';
import type { FleetTripComplianceRow, FleetTripDetail } from '@/lib/fleet-api';
import { fleetComplianceResultBadgeClass } from '@/lib/fleet-compliance';

type Props = {
  tripId: string;
  checks: FleetTripComplianceRow[];
  complianceComplete: boolean;
  onUpdated: (trip: FleetTripDetail) => void;
};

export function FleetTripComplianceSection({
  tripId,
  checks,
  complianceComplete,
  onUpdated,
}: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateCheck(checkType: string, result: string) {
    setSaving(checkType);
    setError(null);
    try {
      const res = await fetch(`/api/fleet/trips/${tripId}/compliance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkType, result }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Unable to update compliance check.');
      }
      onUpdated((await res.json()) as FleetTripDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update compliance check.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Pre-trip compliance</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Licence, insurance, inspection, cargo docs, and permits before dispatch.
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            complianceComplete ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {complianceComplete ? 'All checks passed' : 'Checks pending'}
        </span>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <ul className="mt-5 divide-y divide-neutral-100">
        {checks.map((check) => (
          <li key={check.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{check.checkLabel}</p>
              {check.checkedAt ? (
                <p className="mt-1 text-xs text-neutral-500">
                  {check.resultLabel}
                  {check.checkedByName ? ` · ${check.checkedByName}` : ''}
                  {' · '}
                  {new Date(check.checkedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${fleetComplianceResultBadgeClass(check.result)}`}
              >
                {check.resultLabel}
              </span>
              {(['passed', 'failed', 'waived'] as const).map((result) => (
                <button
                  key={result}
                  type="button"
                  disabled={saving === check.checkType || check.result === result}
                  onClick={() => void updateCheck(check.checkType, result)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition ${
                    check.result === result
                      ? 'border-primary-500 bg-primary-50 text-primary-800'
                      : 'border-neutral-200 text-neutral-600 hover:border-primary-200 hover:bg-neutral-50'
                  }`}
                >
                  {result}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
