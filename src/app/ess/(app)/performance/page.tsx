'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssEmptyState } from '@/components/ess/EssUi';
import { ratingLabel } from '@/lib/performance/service';

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
  const [overallRating, setOverallRating] = useState(3);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/ess/performance', { credentials: 'include' });
      const json = (await res.json()) as EssPerformancePayload;
      setData(json);
      if (json.review) {
        setSelfSummary(json.review.selfSummary ?? '');
        setOverallRating(json.review.overallSelfRating ?? 3);
        setRatings(
          Object.fromEntries(
            (json.review.ratings ?? []).map((r) => [r.dimension, r.selfScore ?? 3]),
          ),
        );
      }
      setLoading(false);
    })();
  }, []);

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
          overallSelfRating: overallRating,
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
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
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

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Goals</h2>
        <ul className="mt-3 space-y-2">
          {data.goals.map((goal) => (
            <li key={goal.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
              {goal.title}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">Self-assessment</h2>
        {data.review.ratings.map((rating) => (
          <label key={rating.id} className="block text-sm">
            <span className="text-zinc-600">{rating.dimension}</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
              disabled={readOnly}
              value={ratings[rating.dimension] ?? 3}
              onChange={(e) =>
                setRatings((prev) => ({ ...prev, [rating.dimension]: parseInt(e.target.value, 10) }))
              }
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} — {ratingLabel(n)}
                </option>
              ))}
            </select>
          </label>
        ))}

        <label className="block text-sm">
          <span className="text-zinc-600">Overall rating</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            disabled={readOnly}
            value={overallRating}
            onChange={(e) => setOverallRating(parseInt(e.target.value, 10))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} — {ratingLabel(n)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-zinc-600">Summary</span>
          <textarea
            className="mt-1 min-h-[100px] w-full rounded-lg border border-zinc-200 px-3 py-2"
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
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm"
              onClick={() => void save(false)}
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void save(true)}
            >
              Submit to manager
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Status: {data.review.status.replace(/_/g, ' ')}</p>
        )}
      </section>
    </div>
  );
}
