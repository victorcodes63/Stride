'use client';

import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';

export type ClinicalRotaAssignment = {
  id: string;
  wardCode: string | null;
  employeeName: string | null;
  clinicalRole: string;
  /** YYYY-MM-DD */
  workDate: string;
  licenseOk: boolean;
  licenseWarnings: string[];
};

export type ClinicalRotaWard = { code: string; name: string };

const ROLE_SHORT: Record<string, string> = {
  nurse: 'Nurse',
  medical_officer: 'MO',
  clinical_officer: 'CO',
};

const ROLE_CHIP: Record<string, string> = {
  nurse: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900',
  medical_officer:
    'bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:ring-violet-900',
  clinical_officer:
    'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900',
};

/** Local-time YYYY-MM-DD (toISOString would shift the day east of UTC). */
function toLocalIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toLocalIsoDate(d);
}

/** Monday of the week containing `date`, as YYYY-MM-DD. */
export function rotaWeekStart(date: Date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return toLocalIsoDate(d);
}

function shortName(name: string | null) {
  if (!name) return 'Unassigned';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]![0]}. ${parts[parts.length - 1]}`;
}

/**
 * Ward × day grid of clinical assignments for one week. Licence problems are flagged in amber.
 * Used on the healthcare rota page and in public previews.
 */
export function ClinicalRotaGrid({
  assignments,
  wards,
  weekStart,
  days = 7,
}: {
  assignments: ClinicalRotaAssignment[];
  /** Ward rows, in order. Defaults to wards that appear in `assignments`. */
  wards?: ClinicalRotaWard[];
  /** YYYY-MM-DD of the first column (usually a Monday). */
  weekStart: string;
  days?: number;
}) {
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(weekStart, i)), [weekStart, days]);

  const rows = useMemo(() => {
    if (wards && wards.length > 0) return wards;
    const codes = Array.from(new Set(assignments.map((a) => a.wardCode).filter(Boolean))) as string[];
    return codes.map((code) => ({ code, name: code }));
  }, [wards, assignments]);

  const byCell = useMemo(() => {
    const map = new Map<string, ClinicalRotaAssignment[]>();
    for (const a of assignments) {
      const key = `${a.wardCode}|${a.workDate}`;
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return map;
  }, [assignments]);

  const flagged = assignments.filter((a) => dates.includes(a.workDate) && !a.licenseOk).length;

  return (
    <div className="dashboard-panel overflow-hidden">
      <div className="dashboard-panel-header flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div>
          <p className="text-sm font-semibold text-[var(--dash-text-strong)]">This week</p>
          <p className="mt-0.5 text-xs text-[var(--dash-text-muted)]">
            {new Date(`${dates[0]}T00:00:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })} –{' '}
            {new Date(`${dates[dates.length - 1]}T00:00:00`).toLocaleDateString('en-KE', {
              day: 'numeric',
              month: 'short',
            })}
          </p>
        </div>
        {flagged > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {flagged} licence {flagged === 1 ? 'issue' : 'issues'}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            All licences valid
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--dash-border-subtle)]">
              <th className="w-28 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--dash-text-subtle)]">
                Ward
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--dash-text-subtle)]"
                >
                  {new Date(`${date}T00:00:00`).toLocaleDateString('en-KE', { weekday: 'short' })}
                  <span className="block text-[10px] font-medium normal-case tracking-normal text-[var(--dash-text-faint)]">
                    {new Date(`${date}T00:00:00`).getDate()}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={dates.length + 1} className="px-4 py-8 text-center text-sm text-[var(--dash-text-muted)]">
                  No wards yet.
                </td>
              </tr>
            ) : (
              rows.map((ward) => (
                <tr key={ward.code} className="border-b border-[var(--dash-border-subtle)] last:border-0">
                  <td className="px-4 py-2.5 align-top">
                    <p className="text-sm font-semibold text-[var(--dash-text-strong)]">{ward.code}</p>
                    {ward.name !== ward.code ? (
                      <p className="truncate text-[11px] text-[var(--dash-text-muted)]">{ward.name}</p>
                    ) : null}
                  </td>
                  {dates.map((date) => {
                    const cell = byCell.get(`${ward.code}|${date}`) ?? [];
                    return (
                      <td key={date} className="px-1.5 py-2 align-top">
                        {cell.length === 0 ? (
                          <span className="block rounded-md border border-dashed border-[var(--dash-border-subtle)] py-1.5 text-center text-[10px] text-[var(--dash-text-faint)]">
                            —
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {cell.map((a) => (
                              <div
                                key={a.id}
                                title={a.licenseOk ? undefined : a.licenseWarnings.join('; ')}
                                className={`rounded-md px-1.5 py-1 text-[10px] leading-tight ring-1 ${
                                  a.licenseOk
                                    ? ROLE_CHIP[a.clinicalRole] ?? ROLE_CHIP.nurse
                                    : 'bg-amber-50 text-amber-900 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800'
                                }`}
                              >
                                <span className="flex items-center gap-1 font-semibold">
                                  {!a.licenseOk ? <AlertTriangle className="h-2.5 w-2.5 shrink-0" aria-hidden /> : null}
                                  <span className="truncate">{shortName(a.employeeName)}</span>
                                </span>
                                <span className="opacity-75">{ROLE_SHORT[a.clinicalRole] ?? a.clinicalRole}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
