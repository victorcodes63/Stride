'use client';

import { useEffect, useState } from 'react';

type Attempt = {
  id: string;
  templateName: string;
  status: string;
  scorePercent: number | null;
  earnedPoints: number | null;
  maxPoints: number | null;
  submittedAt: string | null;
  clientIp: string | null;
  accessUrl: string;
};

export function ApplicationAssessmentsPanel({ applicationId }: { applicationId: string }) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/applications/${encodeURIComponent(applicationId)}/assessments`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setAttempts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [applicationId]);

  if (loading) return null;
  if (attempts.length === 0) return null;

  return (
    <section className="mt-6 border-t border-neutral-200 pt-4">
      <h3 className="text-sm font-semibold text-neutral-900">Assessments</h3>
      <ul className="mt-2 space-y-2">
        {attempts.map((attempt) => (
          <li key={attempt.id} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{attempt.templateName}</span>
              <span className="text-neutral-500 capitalize">{attempt.status.replace('_', ' ')}</span>
            </div>
            {attempt.status === 'submitted' ? (
              <p className="mt-1 text-neutral-600">
                Score: {attempt.scorePercent ?? 0}% ({attempt.earnedPoints}/{attempt.maxPoints})
                {attempt.clientIp ? ` · IP ${attempt.clientIp}` : ''}
              </p>
            ) : (
              <a href={attempt.accessUrl} className="mt-1 inline-block text-[var(--brand-primary)] hover:underline">
                Candidate link
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
