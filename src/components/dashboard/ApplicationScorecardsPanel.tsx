'use client';

import { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2, Star } from 'lucide-react';
import type {
  ApplicationScorecardItem,
  ApplicationScorecardsResponse,
} from '@/app/api/applications/[id]/scorecards/route';

const DECISION_META: Record<string, { label: string; className: string }> = {
  strong_yes: { label: 'Strong yes', className: 'bg-emerald-100 text-emerald-800' },
  yes: { label: 'Yes', className: 'bg-green-50 text-green-700' },
  hold: { label: 'Hold', className: 'bg-amber-50 text-amber-700' },
  no: { label: 'No', className: 'bg-red-50 text-red-700' },
};

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="text-sm font-semibold text-neutral-800 tabular-nums">
        {value == null ? '—' : value}
        <span className="text-xs font-normal text-neutral-400">/5</span>
      </p>
    </div>
  );
}

function ScorecardCard({ item }: { item: ApplicationScorecardItem }) {
  const decision = DECISION_META[item.decision] ?? {
    label: item.decision,
    className: 'bg-neutral-100 text-neutral-600',
  };
  return (
    <li className="rounded-lg border border-neutral-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-neutral-800">
          {item.interviewerName || 'Interviewer'}
        </p>
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${decision.className}`}>
          {decision.label}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Score label="Technical" value={item.technicalScore} />
        <Score label="Comms" value={item.communicationScore} />
        <Score label="Culture" value={item.cultureScore} />
      </div>
      {item.strengths && (
        <p className="mt-2 text-xs text-neutral-600">
          <span className="font-medium text-emerald-700">Strengths:</span> {item.strengths}
        </p>
      )}
      {item.concerns && (
        <p className="mt-1 text-xs text-neutral-600">
          <span className="font-medium text-red-700">Concerns:</span> {item.concerns}
        </p>
      )}
    </li>
  );
}

export function ApplicationScorecardsPanel({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<ApplicationScorecardsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/applications/${applicationId}/scorecards`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-neutral-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading interviewer feedback…
      </div>
    );
  }

  if (!data || data.summary.count === 0) {
    return null;
  }

  const { summary, items } = data;

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-neutral-500">
        <ClipboardCheck className="h-4 w-4" />
        Interviewer feedback
        <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-normal text-neutral-500">
          {summary.count}
        </span>
      </h3>

      <div className="mb-3 flex items-center gap-3 rounded-lg bg-primary-50/50 border border-primary-100 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          <span className="text-lg font-semibold text-primary-900 tabular-nums">
            {summary.avgOverall ?? '—'}
          </span>
          <span className="text-xs text-neutral-500">avg overall</span>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {Object.entries(summary.decisions).map(([decision, n]) => {
            const meta = DECISION_META[decision] ?? {
              label: decision,
              className: 'bg-neutral-100 text-neutral-600',
            };
            return (
              <span key={decision} className={`rounded-md px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                {n} {meta.label}
              </span>
            );
          })}
        </div>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <ScorecardCard key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}
