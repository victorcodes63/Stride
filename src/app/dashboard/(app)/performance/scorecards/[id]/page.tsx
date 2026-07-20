'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { CompetencyMeter } from '@/components/performance';

const PERSPECTIVE_LABEL: Record<string, string> = {
  financial: 'Financial',
  customer: 'Customer / stakeholder',
  internal_process: 'Internal process',
  learning_growth: 'Learning & growth',
};

type Template = {
  title: string;
  grade: string | null;
  resultsWeightPercent: number;
  competenciesWeightPercent: number;
  perspectives?: Array<{ id: string; perspective: string; weightPercent: number }>;
  measures: Array<{ title: string; targetValue: string | null; unit: string | null; weightPercent?: number }>;
  competencies: Array<{ name: string; requiredLevel: number }>;
};

export default function ScorecardDetailPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);

  useEffect(() => {
    void fetch(`/api/performance/scorecards/${params.id}`, { credentials: 'include' })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Scorecard not found');
        setTemplate(data.template);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [params.id]);

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

  if (error || !template) {
    return (
      <DashboardPage>
        <div className="dashboard-surface p-6 text-sm text-[var(--dash-text-body)]">
          {error ?? 'Scorecard not found.'}{' '}
          <Link href="/dashboard/performance/scorecards" className="text-primary-700 hover:underline">
            Back to scorecards
          </Link>
        </div>
      </DashboardPage>
    );
  }

  const perspectives = template.perspectives ?? [];

  return (
    <DashboardPage>
      <DashboardPageHeader
        title={template.title}
        description={`BSC blend ${template.resultsWeightPercent}% results / ${template.competenciesWeightPercent}% competencies`}
        footer={
          <Link href="/dashboard/performance/scorecards" className="btn-secondary h-10 px-3">
            Back to scorecards
          </Link>
        }
      />

      {/* Blend + perspective weights */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="dashboard-surface p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Scoring blend</h2>
          <p className="mb-3 text-xs text-[var(--dash-text-muted)]">
            How results and competencies combine into the final BSC score.
          </p>
          <div
            className="flex h-8 w-full overflow-hidden rounded-lg"
            role="img"
            aria-label={`${template.resultsWeightPercent}% results, ${template.competenciesWeightPercent}% competencies`}
          >
            <div
              className="flex items-center justify-center text-xs font-semibold text-white"
              style={{ width: `${template.resultsWeightPercent}%`, backgroundColor: 'var(--swatch-coral-accent)' }}
            >
              Results {template.resultsWeightPercent}%
            </div>
            <div
              className="flex items-center justify-center text-xs font-semibold text-white"
              style={{
                width: `${template.competenciesWeightPercent}%`,
                backgroundColor: 'var(--swatch-sky-accent)',
              }}
            >
              {template.competenciesWeightPercent}%
            </div>
          </div>
        </section>

        <section className="dashboard-surface p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">BSC perspectives</h2>
          <p className="mb-3 text-xs text-[var(--dash-text-muted)]">KRA weight distribution across perspectives.</p>
          {perspectives.length === 0 ? (
            <p className="text-sm text-[var(--dash-text-muted)]">No perspective weights defined.</p>
          ) : (
            <ul className="space-y-2.5">
              {perspectives.map((p) => (
                <li key={p.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[var(--dash-text-body)]">
                      {PERSPECTIVE_LABEL[p.perspective] ?? p.perspective}
                    </span>
                    <span className="font-semibold tabular-nums text-[var(--dash-text-strong)]">
                      {p.weightPercent}%
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'var(--dash-surface-muted)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, p.weightPercent)}%`,
                        backgroundColor: 'var(--swatch-coral-accent)',
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="dashboard-surface p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--dash-text-strong)]">
            Results measures
            <span className="ml-2 text-xs font-normal text-[var(--dash-text-muted)]">
              {template.measures.length}
            </span>
          </h2>
          <ul className="space-y-2 text-sm">
            {template.measures.map((m, i) => (
              <li
                key={i}
                className="rounded-lg border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--dash-text-strong)]">{m.title}</span>
                  {m.weightPercent != null ? (
                    <span className="text-xs text-[var(--dash-text-muted)]">{m.weightPercent}%</span>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--dash-text-muted)]">
                  Target: {[m.targetValue, m.unit].filter(Boolean).join(' ') || '—'}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="dashboard-surface p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--dash-text-strong)]">
            Competency requirements
            <span className="ml-2 text-xs font-normal text-[var(--dash-text-muted)]">
              {template.competencies.length}
            </span>
          </h2>
          <ul className="space-y-2 text-sm">
            {template.competencies.map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-[var(--dash-border-subtle)] bg-[var(--dash-surface-muted)] px-3 py-2"
              >
                <span className="text-[var(--dash-text-strong)]">{c.name}</span>
                <CompetencyMeter level={c.requiredLevel} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DashboardPage>
  );
}
