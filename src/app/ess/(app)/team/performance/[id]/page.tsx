'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { ratingLabel } from '@/lib/performance/service';

type ReviewDetail = {
  id: string;
  status: string;
  selfSummary: string | null;
  managerSummary: string | null;
  overallSelfRating: number | null;
  overallManagerRating: number | null;
  employee: { firstName: string; lastName: string; employeeNumber: string | null };
  cycle: { name: string; status: string };
  ratings: Array<{ id: string; dimension: string; selfScore: number | null; managerScore: number | null }>;
};

type GoalRow = {
  id: string;
  title: string;
  weightPercent: number;
  selfScore: number | null;
  managerScore: number | null;
};

export default function EssTeamPerformanceReviewPage() {
  const params = useParams<{ id: string }>();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [managerSummary, setManagerSummary] = useState('');
  const [overallRating, setOverallRating] = useState(3);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [goalScores, setGoalScores] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ess/team/performance/${params.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Review not found');
      const r = data.review as ReviewDetail;
      setReview(r);
      setGoals(data.goals ?? []);
      setManagerSummary(r.managerSummary ?? '');
      setOverallRating(r.overallManagerRating ?? 3);
      setRatings(
        Object.fromEntries(
          (r.ratings ?? []).map((rating) => [rating.dimension, rating.managerScore ?? rating.selfScore ?? 3]),
        ),
      );
      setGoalScores(
        Object.fromEntries(
          ((data.goals ?? []) as GoalRow[]).map((g) => [g.id, g.managerScore ?? g.selfScore ?? 3]),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(complete: boolean) {
    if (!review) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/ess/team/performance/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerSummary,
          overallManagerRating: overallRating,
          ratings: Object.entries(ratings).map(([dimension, managerScore]) => ({ dimension, managerScore })),
          goals: Object.entries(goalScores).map(([id, managerScore]) => ({ id, managerScore })),
          complete,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      await load();
      setMessage(complete ? 'Review completed.' : 'Draft saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const canEdit =
    review &&
    review.cycle.status === 'active' &&
    ['self_submitted', 'manager_in_progress'].includes(review.status);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="space-y-4 pb-8">
        <Link href="/ess/team/performance" className="inline-flex items-center gap-1 text-sm text-primary-700">
          <ArrowLeft className="h-4 w-4" />
          Team performance
        </Link>
        <p className="text-sm text-zinc-600">{error ?? 'Review not found.'}</p>
      </div>
    );
  }

  const employeeName = `${review.employee.firstName} ${review.employee.lastName}`.trim();

  return (
    <div className="space-y-4 pb-8">
      <EssPageHeader
        title={employeeName}
        subtitle={review.cycle.name}
        backHref="/ess/team/performance"
      />
      <div className="flex justify-end">
        <EssStatusPill status={review.status} />
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Self-assessment</h2>
        {review.overallSelfRating ? (
          <p className="mt-2 text-sm">
            Overall: {review.overallSelfRating}/5 · {ratingLabel(review.overallSelfRating)}
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Not submitted yet.</p>
        )}
        {review.selfSummary ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{review.selfSummary}</p>
        ) : null}
      </section>

      {goals.length > 0 ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">Goals</h2>
          {goals.map((goal) => (
            <div key={goal.id} className="rounded-xl bg-zinc-50 px-3 py-2 text-sm">
              <p className="font-medium">{goal.title}</p>
              <p className="text-xs text-zinc-500">Weight {goal.weightPercent}%</p>
              {canEdit ? (
                <label className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span>Your score</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={goalScores[goal.id] ?? 3}
                    onChange={(e) =>
                      setGoalScores((prev) => ({ ...prev, [goal.id]: Number(e.target.value) }))
                    }
                  />
                  <span>{goalScores[goal.id] ?? 3}/5</span>
                </label>
              ) : (
                <p className="mt-1 text-xs text-zinc-600">
                  Self {goal.selfScore ?? '—'}/5 · Manager {goal.managerScore ?? '—'}/5
                </p>
              )}
            </div>
          ))}
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">Manager review</h2>
        {!canEdit ? (
          <p className="text-sm text-zinc-500">
            {review.status === 'completed'
              ? 'This review is complete.'
              : 'Available after the employee submits their self-assessment.'}
          </p>
        ) : null}

        {review.ratings.map((rating) => (
          <label key={rating.id} className="block text-sm">
            <span className="text-zinc-700">{rating.dimension}</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                disabled={!canEdit}
                value={ratings[rating.dimension] ?? 3}
                onChange={(e) =>
                  setRatings((prev) => ({ ...prev, [rating.dimension]: Number(e.target.value) }))
                }
                className="flex-1"
              />
              <span className="text-xs text-zinc-600 w-20">{ratings[rating.dimension] ?? 3}/5</span>
            </div>
          </label>
        ))}

        <label className="block text-sm">
          <span className="text-zinc-700">Overall rating</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              disabled={!canEdit}
              value={overallRating}
              onChange={(e) => setOverallRating(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs text-zinc-600 w-20">{overallRating}/5</span>
          </div>
        </label>

        <label className="block text-sm">
          <span className="text-zinc-700">Summary</span>
          <textarea
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-50"
            rows={4}
            disabled={!canEdit}
            value={managerSummary}
            onChange={(e) => setManagerSummary(e.target.value)}
            placeholder="Strengths, development areas, agreed actions…"
          />
        </label>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
              onClick={() => void save(false)}
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-xl bg-primary-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => void save(true)}
            >
              {saving ? 'Saving…' : 'Complete review'}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
