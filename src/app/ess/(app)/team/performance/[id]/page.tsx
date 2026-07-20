'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { ratingLabel } from '@/lib/performance/rating-label';
import { RatingInput, ScoreBadge, SelfVsManagerBars, type ComparisonRow } from '@/components/performance';

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

  const weightedManager = useMemo(() => {
    if (goals.length === 0) return null;
    const totalWeight = goals.reduce((s, g) => s + (g.weightPercent || 0), 0);
    if (totalWeight <= 0) {
      return goals.reduce((s, g) => s + (goalScores[g.id] ?? 0), 0) / goals.length;
    }
    return (
      goals.reduce((s, g) => s + (goalScores[g.id] ?? g.managerScore ?? 0) * (g.weightPercent || 0), 0) /
      totalWeight
    );
  }, [goals, goalScores]);

  const comparisonRows: ComparisonRow[] = useMemo(() => {
    if (!review) return [];
    const goalRows: ComparisonRow[] = goals.map((g) => ({
      label: g.title,
      self: g.selfScore,
      manager: canEdit ? (goalScores[g.id] ?? g.managerScore) : g.managerScore,
      weightPercent: g.weightPercent,
    }));
    const dimRows: ComparisonRow[] = review.ratings.map((r) => ({
      label: r.dimension,
      self: r.selfScore,
      manager: canEdit ? (ratings[r.dimension] ?? r.managerScore) : r.managerScore,
    }));
    return [...goalRows, ...dimRows];
  }, [review, goals, goalScores, ratings, canEdit]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />
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
        <p className="text-sm text-[var(--dash-text-body)]">{error ?? 'Review not found.'}</p>
      </div>
    );
  }

  const employeeName = `${review.employee.firstName} ${review.employee.lastName}`.trim();

  return (
    <div className="space-y-4 pb-8">
      <EssPageHeader title={employeeName} subtitle={review.cycle.name} backHref="/ess/team/performance" />
      <div className="flex justify-end">
        <EssStatusPill status={review.status} />
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <section className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Self-assessment</h2>
          {review.overallSelfRating ? <ScoreBadge score={review.overallSelfRating} /> : null}
        </div>
        {review.selfSummary ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--dash-text-body)]">{review.selfSummary}</p>
        ) : (
          <p className="mt-2 text-sm text-[var(--dash-text-muted)]">Not submitted yet.</p>
        )}
      </section>

      {comparisonRows.length > 0 ? (
        <section className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-[var(--dash-text-strong)]">Self vs manager</h2>
          <SelfVsManagerBars rows={comparisonRows} />
        </section>
      ) : null}

      {goals.length > 0 ? (
        <section className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Goals</h2>
            {weightedManager != null ? (
              <span className="text-xs text-[var(--dash-text-muted)]">
                Weighted: <strong className="text-[var(--dash-text-strong)]">{weightedManager.toFixed(1)}/5</strong>
              </span>
            ) : null}
          </div>
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="rounded-xl bg-[var(--dash-surface-muted)] px-3 py-2.5 text-sm"
            >
              <p className="font-medium text-[var(--dash-text-strong)]">{goal.title}</p>
              <p className="text-xs text-[var(--dash-text-muted)]">
                Weight {goal.weightPercent}% · Self {goal.selfScore ?? '—'}/5
              </p>
              {canEdit ? (
                <div className="mt-2">
                  <RatingInput
                    value={goalScores[goal.id] ?? 3}
                    onChange={(v) => setGoalScores((prev) => ({ ...prev, [goal.id]: v }))}
                    ariaLabel={`Your score for ${goal.title}`}
                    size="sm"
                    showLabel={false}
                  />
                </div>
              ) : (
                <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
                  Manager {goal.managerScore ?? '—'}/5
                </p>
              )}
            </div>
          ))}
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Manager review</h2>
        {!canEdit ? (
          <p className="text-sm text-[var(--dash-text-muted)]">
            {review.status === 'completed'
              ? 'This review is complete.'
              : 'Available after the employee submits their self-assessment.'}
          </p>
        ) : null}

        {review.ratings.map((rating) => (
          <div key={rating.id} className="text-sm">
            <span className="text-[var(--dash-text-body)]">{rating.dimension}</span>
            <div className="mt-1.5">
              <RatingInput
                value={ratings[rating.dimension] ?? 3}
                onChange={(v) => setRatings((prev) => ({ ...prev, [rating.dimension]: v }))}
                disabled={!canEdit}
                ariaLabel={rating.dimension}
              />
            </div>
          </div>
        ))}

        <div className="text-sm">
          <span className="text-[var(--dash-text-body)]">Overall rating</span>
          <div className="mt-1.5">
            <RatingInput
              value={overallRating}
              onChange={setOverallRating}
              disabled={!canEdit}
              ariaLabel="Overall rating"
            />
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-[var(--dash-text-body)]">Summary</span>
          <textarea
            className="mt-1 w-full rounded-xl border border-[var(--dash-input-border)] bg-[var(--dash-input-bg)] px-3 py-2 text-sm text-[var(--dash-text-body)] disabled:opacity-60"
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
              className="rounded-xl border border-[var(--dash-border)] px-4 py-2 text-sm font-medium text-[var(--dash-text-body)] disabled:opacity-50"
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
