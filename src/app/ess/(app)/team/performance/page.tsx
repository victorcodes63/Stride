'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { ScoreBadge } from '@/components/performance';

type ReviewRow = {
  id: string;
  employeeName: string;
  employeeNumber: string | null;
  status: string;
  overallSelfRating: number | null;
};

export default function EssTeamPerformancePage() {
  const [cycle, setCycle] = useState<{ id: string; name: string; periodEnd: string } | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/ess/team/performance')
      .then((r) => r.json())
      .then((data) => {
        setCycle(data.cycle ?? null);
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <EssPageHeader
        title="Team performance"
        subtitle={cycle ? `${cycle.name} · ends ${cycle.periodEnd}` : 'No active cycle'}
        backHref="/ess/team"
      />

      {reviews.length === 0 ? (
        <p className="text-sm text-[var(--dash-text-muted)]">No team reviews awaiting manager input.</p>
      ) : (
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--dash-text-strong)]">{r.employeeName}</p>
                  {r.employeeNumber ? (
                    <p className="text-xs text-[var(--dash-text-muted)]">{r.employeeNumber}</p>
                  ) : null}
                  {r.overallSelfRating ? (
                    <div className="mt-2">
                      <ScoreBadge score={r.overallSelfRating} />
                    </div>
                  ) : null}
                </div>
                <EssStatusPill status={r.status} />
              </div>
              {['self_submitted', 'manager_in_progress'].includes(r.status) ? (
                <Link
                  href={`/ess/team/performance/${r.id}`}
                  className="mt-3 inline-block text-sm font-medium text-primary-700"
                >
                  Complete manager review →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
