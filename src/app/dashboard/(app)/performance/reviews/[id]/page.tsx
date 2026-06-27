'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ratingLabel } from '@/lib/performance/service';
import { dashStatusChip } from '@/lib/dashboard-status-chips';

function reviewStatusTone(status: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'self_submitted' || status === 'manager_in_progress') return 'warning';
  if (status === 'self_in_progress') return 'info';
  return 'neutral';
}

type ReviewDetail = {
  id: string;
  status: string;
  selfSummary: string | null;
  managerSummary: string | null;
  overallSelfRating: number | null;
  overallManagerRating: number | null;
  selfSubmittedAt: string | null;
  managerSubmittedAt: string | null;
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
    department: { name: string } | null;
  };
  cycle: { id: string; name: string; status: string };
  ratings: Array<{
    id: string;
    dimension: string;
    selfScore: number | null;
    managerScore: number | null;
  }>;
};

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  weightPercent: number;
  selfScore: number | null;
  managerScore: number | null;
};

export default function PerformanceReviewDetailPage() {
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
      const res = await fetch(`/api/performance/reviews/${params.id}`, { credentials: 'include' });
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
      setError(e instanceof Error ? e.message : 'Failed to load review');
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
      const res = await fetch(`/api/performance/reviews/${review.id}`, {
        method: 'PATCH',
        credentials: 'include',
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
      setMessage(complete ? 'Manager review completed.' : 'Draft saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const canEditManager =
    review &&
    review.cycle.status === 'active' &&
    ['self_submitted', 'manager_in_progress'].includes(review.status);

  if (loading) {
    return (
      <DashboardPage>
        <div className="flex justify-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading review…
        </div>
      </DashboardPage>
    );
  }

  if (!review) {
    return (
      <DashboardPage>
        <div className="dashboard-surface p-6 text-sm text-neutral-600">
          Review not found.{' '}
          <Link href="/dashboard/performance" className="text-primary-700 hover:underline">
            Back to performance
          </Link>
        </div>
      </DashboardPage>
    );
  }

  const employeeName = `${review.employee.firstName} ${review.employee.lastName}`.trim();

  return (
    <DashboardPage>
      <Link
        href="/dashboard/performance"
        className="mb-3 inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Performance cycles
      </Link>

      <DashboardPageHeader
        title={employeeName}
        description={`${review.cycle.name} · ${review.employee.department?.name ?? 'No department'}${review.employee.employeeNumber ? ` · ${review.employee.employeeNumber}` : ''}`}
        meta={
          <span className={dashStatusChip(reviewStatusTone(review.status))}>
            {review.status.replace(/_/g, ' ')}
          </span>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {message ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="dashboard-surface shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Employee self-assessment</h2>
          {review.selfSubmittedAt ? (
            <p className="mt-1 text-xs text-neutral-500">
              Submitted {new Date(review.selfSubmittedAt).toLocaleString()}
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber-700">Not submitted yet</p>
          )}
          {review.overallSelfRating ? (
            <p className="mt-3 text-sm">
              Overall: <strong>{review.overallSelfRating}/5</strong> · {ratingLabel(review.overallSelfRating)}
            </p>
          ) : null}
          {review.selfSummary ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{review.selfSummary}</p>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">No summary provided.</p>
          )}
          <ul className="mt-4 space-y-2">
            {review.ratings.map((r) => (
              <li key={r.id} className="flex justify-between text-sm">
                <span>{r.dimension}</span>
                <span className="tabular-nums text-neutral-600">
                  {r.selfScore != null ? `${r.selfScore}/5` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="dashboard-surface shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-neutral-900">Goals</h2>
          <ul className="mt-3 space-y-2">
            {goals.map((goal) => (
              <li key={goal.id} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm">
                <div className="font-medium">{goal.title}</div>
                <div className="mt-1 text-xs text-neutral-500">Weight {goal.weightPercent}%</div>
                {canEditManager ? (
                  <label className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span>Manager score</span>
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
                    <span className="w-8 tabular-nums">{goalScores[goal.id] ?? 3}/5</span>
                  </label>
                ) : (
                  <p className="mt-1 text-xs text-neutral-600">
                    Self {goal.selfScore ?? '—'}/5 · Manager {goal.managerScore ?? '—'}/5
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="dashboard-surface shadow-sm mt-4 p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900">Manager review</h2>
        {!canEditManager ? (
          <p className="text-sm text-neutral-500">
            {review.status === 'completed'
              ? 'This review is complete.'
              : 'Available after the employee submits their self-assessment.'}
          </p>
        ) : null}

        {review.ratings.map((rating) => (
          <label key={rating.id} className="block text-sm">
            <span className="text-neutral-700">{rating.dimension}</span>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                disabled={!canEditManager}
                value={ratings[rating.dimension] ?? 3}
                onChange={(e) =>
                  setRatings((prev) => ({ ...prev, [rating.dimension]: Number(e.target.value) }))
                }
                className="flex-1"
              />
              <span className="w-28 text-xs text-neutral-600">
                {ratings[rating.dimension] ?? 3}/5 · {ratingLabel(ratings[rating.dimension])}
              </span>
            </div>
          </label>
        ))}

        <label className="block text-sm">
          <span className="text-neutral-700">Overall manager rating</span>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              disabled={!canEditManager}
              value={overallRating}
              onChange={(e) => setOverallRating(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-28 text-xs text-neutral-600">
              {overallRating}/5 · {ratingLabel(overallRating)}
            </span>
          </div>
        </label>

        <label className="block text-sm">
          <span className="text-neutral-700">Manager summary</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-neutral-50"
            rows={4}
            disabled={!canEditManager}
            value={managerSummary}
            onChange={(e) => setManagerSummary(e.target.value)}
            placeholder="Strengths, development areas, and agreed actions…"
          />
        </label>

        {canEditManager ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              className="btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
              onClick={() => void save(false)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save draft
            </button>
            <button
              type="button"
              disabled={saving}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              onClick={() => void save(true)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Complete review
            </button>
          </div>
        ) : null}
      </section>
    </DashboardPage>
  );
}
