'use client';

import { useEffect, useMemo, useState } from 'react';

import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssEmptyState } from '@/components/ess/EssUi';
import { ratingLabel } from '@/lib/performance/rating-label';
import { RatingInput, ScoreBadge } from '@/components/performance';

type EssPerformancePayload = {
  cycle: { id: string; name: string; periodStart: string; periodEnd: string } | null;
  review: {
    id: string;
    status: string;
    selfSummary: string | null;
    overallSelfRating: number | null;
    ratings: Array<{ id: string; dimension: string; selfScore: number | null }>;
  } | null;
  goals: Array<{ id: string; title: string; selfScore: number | null }>;
};

export default function EssPerformancePage() {
  const [data, setData] = useState<EssPerformancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selfSummary, setSelfSummary] = useState('');
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/ess/performance', { credentials: 'include' });
      const json = (await res.json()) as EssPerformancePayload;
      setData(json);
      if (json.review) {
        setSelfSummary(json.review.selfSummary ?? '');
        setRatings(
          Object.fromEntries((json.review.ratings ?? []).map((r) => [r.dimension, r.selfScore ?? 3])),
        );
      }
      setLoading(false);
    })();
  }, []);

  const derivedOverall = useMemo(() => {
    const values = data?.review?.ratings.map((r) => ratings[r.dimension] ?? 3) ?? [];
    if (values.length === 0) return data?.review?.overallSelfRating ?? 3;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }, [data?.review, ratings]);

  async function save(submit: boolean) {
    if (!data?.review) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/ess/performance', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId: data.review.id,
          selfSummary,
          overallSelfRating: Math.round(derivedOverall),
          ratings: Object.entries(ratings).map(([dimension, selfScore]) => ({ dimension, selfScore })),
          submit,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setData((prev) => (prev ? { ...prev, review: json.review } : prev));
      setMessage(submit ? 'Self-assessment submitted to your manager.' : 'Draft saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />
      </div>
    );
  }

  if (!data?.cycle || !data.review) {
    return (
      <div>
        <EssPageHeader title="Performance" subtitle="Goals and reviews" backHref="/ess/more" />
        <EssEmptyState
          title="No active review cycle"
          message="When HR activates a review cycle, your goals and self-assessment will appear here."
        />
      </div>
    );
  }

  const readOnly = ['self_submitted', 'manager_in_progress', 'completed'].includes(data.review.status);

  return (
    <div className="space-y-4 pb-8">
      <EssPageHeader
        title={data.cycle.name}
        subtitle={`${data.cycle.periodStart} → ${data.cycle.periodEnd}`}
        backHref="/ess/more"
      />

      <section className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Goals</h2>
        <ul className="mt-3 space-y-2">
          {data.goals.map((goal) => (
            <li
              key={goal.id}
              className="rounded-lg bg-[var(--dash-surface-muted)] px-3 py-2 text-sm text-[var(--dash-text-body)]"
            >
              {goal.title}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Self-assessment</h2>
          <ScoreBadge score={derivedOverall} />
        </div>

        {data.review.ratings.map((rating) => (
          <div key={rating.id} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--dash-text-body)]">{rating.dimension}</span>
            </div>
            <div className="mt-1.5">
              <RatingInput
                value={ratings[rating.dimension] ?? 3}
                onChange={(v) => setRatings((prev) => ({ ...prev, [rating.dimension]: v }))}
                disabled={readOnly}
                ariaLabel={rating.dimension}
              />
            </div>
          </div>
        ))}

        <div className="rounded-lg bg-[var(--dash-surface-muted)] px-3 py-2 text-xs text-[var(--dash-text-muted)]">
          Overall rating is calculated from your dimension scores:{' '}
          <strong className="text-[var(--dash-text-strong)]">
            {derivedOverall}/5 · {ratingLabel(derivedOverall)}
          </strong>
        </div>

        <label className="block text-sm">
          <span className="text-[var(--dash-text-body)]">Summary</span>
          <textarea
            className="mt-1 min-h-[100px] w-full rounded-lg border border-[var(--dash-input-border)] bg-[var(--dash-input-bg)] px-3 py-2 text-[var(--dash-text-body)] disabled:opacity-60"
            disabled={readOnly}
            value={selfSummary}
            onChange={(e) => setSelfSummary(e.target.value)}
            placeholder="What went well? What will you improve next period?"
          />
        </label>

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        {!readOnly ? (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              className="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-sm text-[var(--dash-text-body)] disabled:opacity-50"
              onClick={() => void save(false)}
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-lg bg-primary-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void save(true)}
            >
              Submit to manager
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--dash-text-muted)]">
            Status: {data.review.status.replace(/_/g, ' ')}
          </p>
        )}
      </section>
    </div>
  );
}
