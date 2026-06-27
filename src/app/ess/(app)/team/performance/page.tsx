'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssStatusPill } from '@/components/ess/EssStatusPill';

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
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
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
        <p className="text-sm text-zinc-500">No team reviews awaiting manager input.</p>
      ) : (
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-900">{r.employeeName}</p>
                  {r.employeeNumber ? <p className="text-xs text-zinc-500">{r.employeeNumber}</p> : null}
                  {r.overallSelfRating ? (
                    <p className="mt-1 text-xs text-zinc-600">Self rating: {r.overallSelfRating}/5</p>
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
