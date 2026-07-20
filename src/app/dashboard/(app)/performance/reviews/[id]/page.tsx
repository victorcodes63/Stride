'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Check, Loader2, MessageSquare, Scale, Lightbulb } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ratingLabel } from '@/lib/performance/rating-label';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';
import {
  NineBoxMatrix,
  RatingInput,
  ScoreBadge,
  SelfVsManagerBars,
  scoreAccent,
  type ComparisonRow,
  type NineBoxCellData,
} from '@/components/performance';

const RESULTS_WEIGHT = 0.7;
const COMPETENCIES_WEIGHT = 0.3;

function reviewStatusTone(status: string): DashStatusTone {
  if (status === 'completed') return 'success';
  if (status === 'calibration_pending' || status === 'manager_submitted') return 'warning';
  if (status === 'self_in_progress' || status === 'self_submitted') return 'info';
  return 'neutral';
}

function band(score: number | null): 'low' | 'mid' | 'high' | null {
  if (score == null) return null;
  if (score < 2.5) return 'low';
  if (score < 3.5) return 'mid';
  return 'high';
}

type ReviewDetail = {
  id: string;
  status: string;
  selfSummary: string | null;
  managerSummary: string | null;
  overallSelfRating: number | null;
  overallManagerRating: number | null;
  finalBlendedScore?: number | null;
  finalResultsScore?: number | null;
  finalCompetenciesScore?: number | null;
  selfSubmittedAt: string | null;
  managerSubmittedAt: string | null;
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
    department: { name: string } | null;
  };
  cycle: { id: string; name: string; status: string; method?: string };
  ratings: Array<{
    id: string;
    dimension: string;
    selfScore: number | null;
    managerScore: number | null;
  }>;
  feedback?: Array<{
    id: string;
    authorType: string;
    content: string;
    createdAt: string;
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

type AiSuggestions = {
  summary: string;
  goals: Array<{ goalId: string; title: string; suggestedScore: number | null; rationale: string }>;
  competencies: Array<{ dimension: string; suggestedScore: number | null; rationale: string }>;
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
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestions | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

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
      setMessage(complete ? 'Manager review submitted for calibration.' : 'Draft saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function fetchAiSuggestions() {
    setAiBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/performance/reviews/${params.id}/ai-suggestions`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AI assist unavailable');
      setAiSuggestions(data.suggestions);
      setMessage('AI suggestions loaded — apply or override each score.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI assist failed');
    } finally {
      setAiBusy(false);
    }
  }

  async function calibrate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/performance/reviews/${params.id}/calibrate`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Calibration failed');
      setMessage('Review calibrated and finalized.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calibration failed');
    } finally {
      setSaving(false);
    }
  }

  const canEditManager =
    review &&
    review.cycle.status === 'active' &&
    ['self_submitted', 'manager_in_progress', 'manager_submitted'].includes(review.status);
  const canCalibrate = review?.status === 'calibration_pending';
  const isBsc = review?.cycle.method === 'bsc';

  // Live projected BSC scores from current manager inputs (before finalization).
  const projected = useMemo(() => {
    const totalWeight = goals.reduce((sum, g) => sum + (g.weightPercent || 0), 0);
    const resultsScore =
      goals.length === 0
        ? null
        : totalWeight > 0
          ? goals.reduce((sum, g) => sum + (goalScores[g.id] ?? g.managerScore ?? g.selfScore ?? 0) * (g.weightPercent || 0), 0) /
            totalWeight
          : goals.reduce((sum, g) => sum + (goalScores[g.id] ?? 0), 0) / goals.length;
    const dims = review?.ratings ?? [];
    const competenciesScore =
      dims.length === 0
        ? null
        : dims.reduce((sum, d) => sum + (ratings[d.dimension] ?? d.managerScore ?? d.selfScore ?? 0), 0) / dims.length;
    const blended =
      resultsScore != null && competenciesScore != null
        ? resultsScore * RESULTS_WEIGHT + competenciesScore * COMPETENCIES_WEIGHT
        : null;
    return { resultsScore, competenciesScore, blended };
  }, [goals, goalScores, ratings, review?.ratings]);

  const displayResults = review?.finalResultsScore ?? projected.resultsScore;
  const displayCompetencies = review?.finalCompetenciesScore ?? projected.competenciesScore;
  const displayBlended = review?.finalBlendedScore ?? projected.blended;
  const isFinal = review?.finalBlendedScore != null;

  const comparisonRows: ComparisonRow[] = useMemo(() => {
    if (!review) return [];
    const goalRows: ComparisonRow[] = goals.map((g) => ({
      label: g.title,
      self: g.selfScore,
      manager: canEditManager ? (goalScores[g.id] ?? g.managerScore) : g.managerScore,
      weightPercent: g.weightPercent,
    }));
    const dimRows: ComparisonRow[] = review.ratings.map((r) => ({
      label: r.dimension,
      self: r.selfScore,
      manager: canEditManager ? (ratings[r.dimension] ?? r.managerScore) : r.managerScore,
    }));
    return [...goalRows, ...dimRows];
  }, [review, goals, goalScores, ratings, canEditManager]);

  if (loading) {
    return (
      <DashboardPage>
        <div className="space-y-4">
          <div className="h-24 w-full animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />
            <div className="h-64 animate-pulse rounded-2xl bg-[var(--dash-surface-muted)]" />
          </div>
        </div>
      </DashboardPage>
    );
  }

  if (!review) {
    return (
      <DashboardPage>
        <div className="dashboard-surface p-6 text-sm text-[var(--dash-text-body)]">
          Review not found.{' '}
          <Link href="/dashboard/performance" className="text-primary-700 hover:underline">
            Back to performance
          </Link>
        </div>
      </DashboardPage>
    );
  }

  const employeeName = `${review.employee.firstName} ${review.employee.lastName}`.trim();
  const goalSuggestion = (goalId: string) => aiSuggestions?.goals.find((g) => g.goalId === goalId);
  const dimSuggestion = (dimension: string) =>
    aiSuggestions?.competencies.find((c) => c.dimension === dimension);

  const singlePersonCells: NineBoxCellData[] = (() => {
    const rb = band(displayResults ?? null);
    const cb = band(displayCompetencies ?? null);
    const cells: NineBoxCellData[] = [];
    for (const r of ['low', 'mid', 'high'] as const) {
      for (const c of ['low', 'mid', 'high'] as const) {
        const here = r === rb && c === cb;
        cells.push({ resultsBand: r, competencyBand: c, count: here ? 1 : 0, employees: here ? [employeeName] : [] });
      }
    }
    return cells;
  })();

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

      {/* BSC score summary */}
      {isBsc && displayBlended != null ? (
        <section className="dashboard-surface mb-4 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">
                {isFinal ? 'Final BSC score' : 'Projected BSC score'}
              </h2>
              <p className="text-xs text-[var(--dash-text-muted)]">
                Results ({Math.round(RESULTS_WEIGHT * 100)}%) + Competencies ({Math.round(COMPETENCIES_WEIGHT * 100)}%)
                {isFinal ? '' : ' · updates live as you rate'}
              </p>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-3xl font-bold tabular-nums"
                style={{ color: scoreAccent(displayBlended) }}
              >
                {displayBlended.toFixed(2)}
              </span>
              <span className="text-sm text-[var(--dash-text-muted)]">/5 · {ratingLabel(displayBlended)}</span>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <SplitBar
              label={`Results · ${Math.round(RESULTS_WEIGHT * 100)}%`}
              score={displayResults ?? null}
            />
            <SplitBar
              label={`Competencies · ${Math.round(COMPETENCIES_WEIGHT * 100)}%`}
              score={displayCompetencies ?? null}
            />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Comparison */}
        <section className="dashboard-surface shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Self vs manager</h2>
          <p className="mb-4 text-xs text-[var(--dash-text-muted)]">
            Goals and competencies — manager values update live while editing.
          </p>
          <SelfVsManagerBars rows={comparisonRows} />
        </section>

        {/* Self assessment */}
        <section className="dashboard-surface shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Employee self-assessment</h2>
            {review.overallSelfRating ? <ScoreBadge score={review.overallSelfRating} /> : null}
          </div>
          {review.selfSubmittedAt ? (
            <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
              Submitted {new Date(review.selfSubmittedAt).toLocaleString()}
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber-700">Not submitted yet</p>
          )}
          {review.selfSummary ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--dash-text-body)]">{review.selfSummary}</p>
          ) : (
            <p className="mt-3 text-sm text-[var(--dash-text-muted)]">No summary provided.</p>
          )}
        </section>
      </div>

      {/* Manager review */}
      <section className="dashboard-surface shadow-sm mt-4 p-4 sm:p-5 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Manager review</h2>
          {canEditManager ? (
            <button
              type="button"
              disabled={aiBusy}
              className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"
              onClick={() => void fetchAiSuggestions()}
            >
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
              AI suggestions
            </button>
          ) : null}
        </div>

        {!canEditManager ? (
          <p className="text-sm text-[var(--dash-text-muted)]">
            {review.status === 'completed'
              ? 'This review is complete.'
              : 'Available after the employee submits their self-assessment.'}
          </p>
        ) : null}

        {aiSuggestions?.summary ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                {aiSuggestions.summary}
              </p>
              {canEditManager ? (
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-violet-300 px-2 py-1 text-xs font-medium hover:bg-violet-100 dark:border-violet-500/40"
                  onClick={() => setManagerSummary(aiSuggestions.summary)}
                >
                  Use as summary
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Goals */}
        {goals.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
              Goals / measures
            </h3>
            {goals.map((goal) => {
              const suggestion = goalSuggestion(goal.id);
              return (
                <div
                  key={goal.id}
                  className="rounded-lg border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)] px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--dash-text-strong)]">{goal.title}</div>
                      <div className="text-xs text-[var(--dash-text-muted)]">
                        Weight {goal.weightPercent}% · Self {goal.selfScore ?? '—'}/5
                      </div>
                    </div>
                    {canEditManager ? (
                      <RatingInput
                        value={goalScores[goal.id] ?? 3}
                        onChange={(v) => setGoalScores((prev) => ({ ...prev, [goal.id]: v }))}
                        ariaLabel={`Manager score for ${goal.title}`}
                        size="sm"
                        showLabel={false}
                      />
                    ) : (
                      <ScoreBadge score={goal.managerScore} withLabel={false} />
                    )}
                  </div>
                  {canEditManager && suggestion?.suggestedScore != null ? (
                    <AiSuggestChip
                      score={suggestion.suggestedScore}
                      rationale={suggestion.rationale}
                      onApply={() =>
                        setGoalScores((prev) => ({ ...prev, [goal.id]: suggestion.suggestedScore as number }))
                      }
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Competencies */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
            Competencies
          </h3>
          {review.ratings.map((rating) => {
            const suggestion = dimSuggestion(rating.dimension);
            return (
              <div
                key={rating.id}
                className="rounded-lg border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)] px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--dash-text-strong)]">{rating.dimension}</div>
                    <div className="text-xs text-[var(--dash-text-muted)]">Self {rating.selfScore ?? '—'}/5</div>
                  </div>
                  {canEditManager ? (
                    <RatingInput
                      value={ratings[rating.dimension] ?? 3}
                      onChange={(v) => setRatings((prev) => ({ ...prev, [rating.dimension]: v }))}
                      ariaLabel={`Manager score for ${rating.dimension}`}
                      size="sm"
                      showLabel={false}
                    />
                  ) : (
                    <ScoreBadge score={rating.managerScore} withLabel={false} />
                  )}
                </div>
                {canEditManager && suggestion?.suggestedScore != null ? (
                  <AiSuggestChip
                    score={suggestion.suggestedScore}
                    rationale={suggestion.rationale}
                    onApply={() =>
                      setRatings((prev) => ({ ...prev, [rating.dimension]: suggestion.suggestedScore as number }))
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Overall + summary */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="text-sm text-[var(--dash-text-body)]">Overall manager rating</span>
            <div className="mt-2">
              <RatingInput
                value={overallRating}
                onChange={setOverallRating}
                disabled={!canEditManager}
                ariaLabel="Overall manager rating"
              />
            </div>
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-[var(--dash-text-body)]">Manager summary</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--dash-input-border)] bg-[var(--dash-input-bg)] px-3 py-2 text-sm text-[var(--dash-text-body)] focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:opacity-60"
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

      {/* Calibration */}
      {(canCalibrate || isFinal) && isBsc ? (
        <section className="dashboard-surface shadow-sm mt-4 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
            <Scale className="h-4 w-4" />
            HR calibration
          </h2>
          <p className="mt-1 text-xs text-[var(--dash-text-muted)]">
            {isFinal
              ? 'Finalized 9-box position for this employee.'
              : 'Confirm the blended BSC score and lock the 9-box placement.'}
          </p>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-center">
            <NineBoxMatrix cells={singlePersonCells} />
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4">
                <Metric label="Results" score={displayResults ?? null} />
                <Metric label="Competencies" score={displayCompetencies ?? null} />
                <Metric label="Blended" score={displayBlended ?? null} />
              </div>
              {canCalibrate ? (
                <button
                  type="button"
                  disabled={saving}
                  className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                  onClick={() => void calibrate()}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Finalize calibration
                </button>
              ) : (
                <span className={dashStatusChip('success')}>Calibrated</span>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* Feedback thread */}
      {review.feedback && review.feedback.length > 0 ? (
        <section className="dashboard-surface shadow-sm mt-4 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--dash-text-strong)]">
            <MessageSquare className="h-4 w-4" />
            Feedback & discussion
          </h2>
          <ul className="mt-4 space-y-3">
            {review.feedback.map((f) => (
              <li key={f.id} className="rounded-lg border border-[var(--dash-border-subtle)] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={dashStatusChip(f.authorType === 'manager' ? 'primary' : f.authorType === 'hr' ? 'warning' : 'info')}>
                    {f.authorType}
                  </span>
                  <span className="text-xs text-[var(--dash-text-muted)]">
                    {new Date(f.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--dash-text-body)]">{f.content}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </DashboardPage>
  );
}

function SplitBar({ label, score }: { label: string; score: number | null }) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, (score / 5) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[var(--dash-text-body)]">{label}</span>
        <span className="font-semibold tabular-nums text-[var(--dash-text-strong)]">
          {score == null ? '—' : `${score.toFixed(2)}/5`}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--dash-surface-muted)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: scoreAccent(score) }}
        />
      </div>
    </div>
  );
}

function Metric({ label, score }: { label: string; score: number | null }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--dash-text-muted)]">{label}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color: scoreAccent(score) }}>
        {score == null ? '—' : score.toFixed(2)}
      </div>
    </div>
  );
}

function AiSuggestChip({
  score,
  rationale,
  onApply,
}: {
  score: number;
  rationale: string;
  onApply: () => void;
}) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md bg-violet-50 px-2.5 py-1.5 text-xs text-violet-900 dark:bg-violet-500/10 dark:text-violet-200">
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        <strong>Suggests {score}/5.</strong> {rationale}
      </span>
      <button
        type="button"
        className="shrink-0 rounded border border-violet-300 px-2 py-0.5 font-medium hover:bg-violet-100 dark:border-violet-500/40"
        onClick={onApply}
      >
        Apply
      </button>
    </div>
  );
}
