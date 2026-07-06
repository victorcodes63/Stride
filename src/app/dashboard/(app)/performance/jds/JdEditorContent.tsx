'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Send } from 'lucide-react';

import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import type { JobDescriptionDetailDto, JobDescriptionInput } from '@/lib/performance/jd/types';

type DivisionOption = { id: string; name: string };

const EMPTY_FORM: JobDescriptionInput = {
  title: '',
  grade: '',
  jobPurpose: '',
  keyActivities: '',
  authorityScope: '',
  workingConditions: '',
  qualifications: '',
  relationships: '',
  kras: [
    {
      title: 'Financial performance',
      bscPerspective: 'financial',
      weightPercent: 30,
      kpis: [{ name: 'Budget variance', targetValue: '≤5', unit: '%', weightPercent: 100 }],
    },
  ],
  competencies: [{ name: 'Integrity & safety mindset', requiredLevel: 4 }],
};

type Props = {
  jobDescriptionId?: string;
};

export function JdEditorContent({ jobDescriptionId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<JobDescriptionInput>(EMPTY_FORM);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [status, setStatus] = useState<string>('draft');
  const [loading, setLoading] = useState(Boolean(jobDescriptionId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDivisions = useCallback(async () => {
    const res = await fetch('/api/performance/jds/divisions', { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setDivisions(data.divisions ?? []);
  }, []);

  const loadJd = useCallback(async () => {
    if (!jobDescriptionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/performance/jds/${jobDescriptionId}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load JD');
      const jd = data.jobDescription as JobDescriptionDetailDto;
      setStatus(jd.status);
      setForm({
        divisionId: jd.divisionId,
        title: jd.title,
        grade: jd.grade ?? '',
        jobPurpose: jd.jobPurpose ?? '',
        keyActivities: jd.keyActivities ?? '',
        authorityScope: jd.authorityScope ?? '',
        workingConditions: jd.workingConditions ?? '',
        qualifications: jd.qualifications ?? '',
        relationships: jd.relationships ?? '',
        kras: jd.kras.map((kra) => ({
          title: kra.title,
          description: kra.description ?? undefined,
          bscPerspective: kra.bscPerspective ?? undefined,
          weightPercent: kra.weightPercent,
          sortOrder: kra.sortOrder,
          kpis: kra.kpis.map((kpi) => ({
            name: kpi.name,
            description: kpi.description ?? undefined,
            targetValue: kpi.targetValue ?? undefined,
            unit: kpi.unit ?? undefined,
            weightPercent: kpi.weightPercent,
            sortOrder: kpi.sortOrder,
          })),
        })),
        competencies: jd.competencies.map((c) => ({
          name: c.name,
          description: c.description ?? undefined,
          requiredLevel: c.requiredLevel,
          sortOrder: c.sortOrder,
        })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [jobDescriptionId]);

  useEffect(() => {
    void loadDivisions();
    void loadJd();
  }, [loadDivisions, loadJd]);

  async function saveDraft() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(jobDescriptionId ? `/api/performance/jds/${jobDescriptionId}` : '/api/performance/jds', {
        method: jobDescriptionId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      if (!jobDescriptionId) {
        router.push(`/dashboard/performance/jds/${data.jobDescription.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!jobDescriptionId) {
      await saveDraft();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveDraft();
      const res = await fetch(`/api/performance/jds/${jobDescriptionId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Publish failed');
      setStatus('published');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading job description…
      </div>
    );
  }

  const readOnly = status !== 'draft';

  return (
    <DashboardPage>
      <DashboardPageHeader
        title={jobDescriptionId ? form.title || 'Edit job description' : 'New job description'}
        description="Structured manual entry — 10 JD sections, KRAs with BSC perspective, KPIs, and competency levels (1–5). Human confirm before publish."
        footer={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/performance/jds" className="btn-secondary h-10 px-3">
              Back to library
            </Link>
            {!readOnly ? (
              <>
                <button type="button" disabled={busy} className="btn-secondary inline-flex h-10 items-center gap-2 px-3" onClick={() => void saveDraft()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save draft
                </button>
                <button type="button" disabled={busy} className="btn-primary inline-flex h-10 items-center gap-2 px-4" onClick={() => void publish()}>
                  <Send className="h-4 w-4" />
                  Publish
                </button>
              </>
            ) : (
              <span className="inline-flex h-10 items-center rounded-lg bg-emerald-100 px-3 text-sm font-medium text-emerald-800">
                Published — create a new version to edit (coming in cycle engine)
              </span>
            )}
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="dashboard-surface space-y-4 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm md:col-span-2">
            <span className="text-neutral-500">Role title</span>
            <input
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-neutral-500">Grade</span>
            <input
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.grade ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
            />
          </label>
          <label className="text-sm md:col-span-3">
            <span className="text-neutral-500">Division</span>
            <select
              disabled={readOnly}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={form.divisionId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, divisionId: e.target.value || null }))}
            >
              <option value="">—</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(
          [
            ['jobPurpose', 'Job purpose'],
            ['keyActivities', 'Key activities'],
            ['authorityScope', 'Authority & scope'],
            ['workingConditions', 'Working conditions'],
            ['qualifications', 'Qualifications'],
            ['relationships', 'Relationships'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            <span className="text-neutral-500">{label}</span>
            <textarea
              disabled={readOnly}
              rows={3}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
              value={(form[key] as string) ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">KRAs & KPIs (Balanced Scorecard)</h2>
          {(form.kras ?? []).map((kra, kraIdx) => (
            <div key={kraIdx} className="rounded-xl border border-neutral-200 p-3 space-y-2">
              <input
                disabled={readOnly}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium"
                value={kra.title}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kras: (f.kras ?? []).map((row, i) => (i === kraIdx ? { ...row, title: e.target.value } : row)),
                  }))
                }
              />
              <select
                disabled={readOnly}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={kra.bscPerspective ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kras: (f.kras ?? []).map((row, i) =>
                      i === kraIdx ? { ...row, bscPerspective: e.target.value as never } : row,
                    ),
                  }))
                }
              >
                <option value="">Perspective</option>
                <option value="financial">Financial</option>
                <option value="customer">Customer / stakeholder</option>
                <option value="internal_process">Internal process</option>
                <option value="learning_growth">Learning & growth</option>
              </select>
              {(kra.kpis ?? []).map((kpi, kpiIdx) => (
                <div key={kpiIdx} className="grid gap-2 sm:grid-cols-3">
                  <input
                    disabled={readOnly}
                    placeholder="KPI name"
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm sm:col-span-2"
                    value={kpi.name}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        kras: (f.kras ?? []).map((row, i) =>
                          i === kraIdx
                            ? {
                                ...row,
                                kpis: (row.kpis ?? []).map((k, j) =>
                                  j === kpiIdx ? { ...k, name: e.target.value } : k,
                                ),
                              }
                            : row,
                        ),
                      }))
                    }
                  />
                  <input
                    disabled={readOnly}
                    placeholder="Target"
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    value={kpi.targetValue ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        kras: (f.kras ?? []).map((row, i) =>
                          i === kraIdx
                            ? {
                                ...row,
                                kpis: (row.kpis ?? []).map((k, j) =>
                                  j === kpiIdx ? { ...k, targetValue: e.target.value } : k,
                                ),
                              }
                            : row,
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Competencies (required level 1–5)</h2>
          {(form.competencies ?? []).map((c, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_120px]">
              <input
                disabled={readOnly}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={c.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    competencies: (f.competencies ?? []).map((row, i) =>
                      i === idx ? { ...row, name: e.target.value } : row,
                    ),
                  }))
                }
              />
              <input
                disabled={readOnly}
                type="number"
                min={1}
                max={5}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={c.requiredLevel}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    competencies: (f.competencies ?? []).map((row, i) =>
                      i === idx ? { ...row, requiredLevel: Number(e.target.value) } : row,
                    ),
                  }))
                }
              />
            </div>
          ))}
        </div>
      </div>
    </DashboardPage>
  );
}
