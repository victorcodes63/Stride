'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Download,
  FileText,
  Loader2,
  Plus,
  Save,
  Send,
  Target,
  Trash2,
} from 'lucide-react';

import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { StrideSelect } from '@/components/ui/stride-select';
import { CompetencyMeter } from '@/components/performance';
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

const SECTION_FIELDS = [
  ['jobPurpose', 'Job purpose'],
  ['keyActivities', 'Key activities'],
  ['authorityScope', 'Authority & scope'],
  ['workingConditions', 'Working conditions'],
  ['qualifications', 'Qualifications'],
  ['relationships', 'Relationships'],
] as const;

const PERSPECTIVE_LABEL: Record<string, string> = {
  financial: 'Financial',
  customer: 'Customer',
  internal_process: 'Internal process',
  learning_growth: 'Learning & growth',
};

type Props = {
  jobDescriptionId?: string;
};

function statusBadgeClass(status: string) {
  if (status === 'published') return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
  if (status === 'archived') return 'bg-zinc-100 text-zinc-700 ring-zinc-200';
  return 'bg-amber-100 text-amber-900 ring-amber-200';
}

export function JdEditorContent({ jobDescriptionId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<JobDescriptionInput>(EMPTY_FORM);
  const [detail, setDetail] = useState<JobDescriptionDetailDto | null>(null);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [status, setStatus] = useState<string>('draft');
  const [loading, setLoading] = useState(Boolean(jobDescriptionId));
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
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
      setDetail(jd);
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
      } else {
        setDetail(data.jobDescription as JobDescriptionDetailDto);
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
      setDetail(data.jobDescription as JobDescriptionDetailDto);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  }

  async function exportPdf() {
    if (!jobDescriptionId) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/performance/jds/${jobDescriptionId}/pdf`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'PDF export failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? 'job-description.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      setExporting(false);
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
  const divisionName =
    detail?.divisionName ??
    divisions.find((d) => d.id === form.divisionId)?.name ??
    null;

  return (
    <DashboardPage>
      <DashboardPageHeader
        title={jobDescriptionId ? form.title || 'Job description' : 'New job description'}
        description={
          readOnly
            ? 'Published role profile — export or generate a scorecard.'
            : 'Purpose, KRAs, KPIs, and competency levels.'
        }
        footer={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/performance/jds" className="btn-secondary h-10 px-3">
              Back to library
            </Link>
            {jobDescriptionId ? (
              <button
                type="button"
                disabled={exporting}
                className="btn-secondary inline-flex h-10 items-center gap-2 px-3"
                onClick={() => void exportPdf()}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export PDF
              </button>
            ) : null}
            {!readOnly ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className="btn-secondary inline-flex h-10 items-center gap-2 px-3"
                  onClick={() => void saveDraft()}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="btn-primary inline-flex h-10 items-center gap-2 px-4"
                  onClick={() => void publish()}
                >
                  <Send className="h-4 w-4" />
                  Publish
                </button>
              </>
            ) : (
              <span
                className={`inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium ring-1 ring-inset ${statusBadgeClass(status)}`}
              >
                {status === 'published'
                  ? 'Published — new versioning coming in cycle engine'
                  : status}
              </span>
            )}
            {status === 'published' && jobDescriptionId ? (
              <button
                type="button"
                disabled={busy}
                className="btn-secondary inline-flex h-10 items-center gap-2 px-3"
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const res = await fetch('/api/performance/scorecards', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ jobDescriptionId }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? 'Scorecard generation failed');
                    router.push(`/dashboard/performance/scorecards/${data.template.id}`);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Scorecard generation failed');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Target className="h-4 w-4" />
                Generate BSC scorecard
              </button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {readOnly ? (
        <JdDocumentView
          title={form.title}
          grade={form.grade ?? null}
          divisionName={divisionName}
          status={status}
          version={detail?.version ?? 1}
          publishedAt={detail?.publishedAt ?? null}
          form={form}
        />
      ) : (
        <JdDraftForm form={form} setForm={setForm} divisions={divisions} />
      )}
    </DashboardPage>
  );
}

function JdDocumentView({
  title,
  grade,
  divisionName,
  status,
  version,
  publishedAt,
  form,
}: {
  title: string;
  grade: string | null;
  divisionName: string | null;
  status: string;
  version: number;
  publishedAt: string | null;
  form: JobDescriptionInput;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--sc-line,#e6ded4)] bg-[var(--sc-paper,#fbf8f4)] text-[var(--sc-ink,#1a1714)] shadow-sm">
      {/* Document masthead */}
      <header className="relative bg-[var(--sc-ink,#1a1714)] px-6 py-7 text-[var(--sc-on-ink-fg,#fbf8f4)] sm:px-8">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-[var(--stride-coral,#ff5436)]" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--sc-on-ink-fg-subtle,rgba(251,248,244,0.65))]">
          Job description
        </p>
        <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {grade ? (
            <span className="rounded-md bg-white/10 px-2.5 py-1 text-white/90 ring-1 ring-white/15">
              {grade}
            </span>
          ) : null}
          {divisionName ? (
            <span className="rounded-md bg-white/10 px-2.5 py-1 text-white/90 ring-1 ring-white/15">
              {divisionName}
            </span>
          ) : null}
          <span className="rounded-md bg-white/10 px-2.5 py-1 capitalize text-white/90 ring-1 ring-white/15">
            {status} · v{version}
          </span>
        </div>
      </header>

      {/* Meta grid */}
      <div className="grid gap-px border-b border-[var(--sc-line,#e6ded4)] bg-[var(--sc-line,#e6ded4)] sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ['Job title', title],
            ['Division', divisionName ?? '—'],
            ['Grade', grade ?? '—'],
            ['Version', `v${version}`],
            ['Status', status],
            [
              'Published',
              publishedAt
                ? new Date(publishedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—',
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="bg-[var(--sc-paper,#fbf8f4)] px-5 py-3.5 sm:px-6">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sc-ink-subtle,#8a8076)]">
              {label}
            </dt>
            <dd className="mt-1 text-sm font-medium capitalize text-[var(--sc-ink,#1a1714)]">{value}</dd>
          </div>
        ))}
      </div>

      <div className="space-y-8 px-6 py-8 sm:px-8">
        {SECTION_FIELDS.map(([key, label]) => {
          const body = (form[key] as string)?.trim();
          if (!body) return null;
          return (
            <section key={key}>
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sc-ink,#1a1714)]">
                <span className="inline-block h-0.5 w-5 bg-[var(--stride-coral,#ff5436)]" aria-hidden />
                {label}
              </h3>
              <p className="mt-3 max-w-3xl whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--sc-ink-muted,#3d3833)]">
                {body}
              </p>
            </section>
          );
        })}

        <section>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sc-ink,#1a1714)]">
            <span className="inline-block h-0.5 w-5 bg-[var(--stride-coral,#ff5436)]" aria-hidden />
            Key result areas
          </h3>
          <div className="mt-4 space-y-4">
            {(form.kras ?? []).map((kra, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[var(--sc-line,#e6ded4)] bg-white/80 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--sc-ink,#1a1714)]">
                      {idx + 1}. {kra.title}
                    </p>
                    {kra.description ? (
                      <p className="mt-1 text-sm text-[var(--sc-ink-muted,#3d3833)]">{kra.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {kra.bscPerspective ? (
                      <span className="rounded-md bg-[var(--sc-paper-2,#f4efe8)] px-2 py-1 font-medium text-[var(--sc-ink-muted,#3d3833)] ring-1 ring-[var(--sc-line,#e6ded4)]">
                        {PERSPECTIVE_LABEL[kra.bscPerspective] ?? kra.bscPerspective}
                      </span>
                    ) : null}
                    <span className="rounded-md bg-[var(--sc-paper-2,#f4efe8)] px-2 py-1 font-medium text-[var(--sc-ink-muted,#3d3833)] ring-1 ring-[var(--sc-line,#e6ded4)]">
                      {kra.weightPercent}% weight
                    </span>
                  </div>
                </div>

                {(kra.kpis ?? []).length > 0 ? (
                  <div className="mt-4 overflow-hidden rounded-lg border border-[var(--sc-line,#e6ded4)]">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--sc-paper-2,#f4efe8)] text-[11px] uppercase tracking-wide text-[var(--sc-ink-subtle,#8a8076)]">
                        <tr>
                          <th className="w-10 px-3 py-2 font-semibold">#</th>
                          <th className="px-3 py-2 font-semibold">Key performance indicator</th>
                          <th className="w-36 px-3 py-2 font-semibold">Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(kra.kpis ?? []).map((kpi, kpiIdx) => (
                          <tr key={kpiIdx} className="border-t border-[var(--sc-line,#e6ded4)]">
                            <td className="px-3 py-2.5 text-[var(--sc-ink-subtle,#8a8076)]">{kpiIdx + 1}</td>
                            <td className="px-3 py-2.5 text-[var(--sc-ink,#1a1714)]">{kpi.name}</td>
                            <td className="px-3 py-2.5 text-[var(--sc-ink-muted,#3d3833)]">
                              {[kpi.targetValue, kpi.unit].filter(Boolean).join(' ') || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sc-ink,#1a1714)]">
            <span className="inline-block h-0.5 w-5 bg-[var(--stride-coral,#ff5436)]" aria-hidden />
            Knowledge, skills &amp; competencies
          </h3>
          <ul className="mt-4 divide-y divide-[var(--sc-line,#e6ded4)] overflow-hidden rounded-xl border border-[var(--sc-line,#e6ded4)] bg-white/80">
            {(form.competencies ?? []).map((c, idx) => (
              <li key={idx} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-[var(--sc-ink-subtle,#8a8076)]" aria-hidden />
                  <span className="text-sm font-medium text-[var(--sc-ink,#1a1714)]">{c.name}</span>
                </div>
                <CompetencyMeter
                  level={c.requiredLevel}
                  filledColor="var(--sc-ink,#1a1714)"
                  emptyColor="var(--sc-line,#e6ded4)"
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}

function JdDraftForm({
  form,
  setForm,
  divisions,
}: {
  form: JobDescriptionInput;
  setForm: Dispatch<SetStateAction<JobDescriptionInput>>;
  divisions: DivisionOption[];
}) {
  const kras = form.kras ?? [];
  const kraWeightTotal = kras.reduce((sum, k) => sum + (k.weightPercent ?? 0), 0);
  const kraWeightOk = kras.length === 0 || kraWeightTotal === 100;

  const updateKra = (idx: number, patch: Partial<(typeof kras)[number]>) =>
    setForm((f) => ({
      ...f,
      kras: (f.kras ?? []).map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));

  const addKra = () =>
    setForm((f) => ({
      ...f,
      kras: [
        ...(f.kras ?? []),
        { title: 'New KRA', bscPerspective: 'internal_process', weightPercent: 0, kpis: [] },
      ],
    }));

  const removeKra = (idx: number) =>
    setForm((f) => ({ ...f, kras: (f.kras ?? []).filter((_, i) => i !== idx) }));

  const updateKpi = (kraIdx: number, kpiIdx: number, patch: Record<string, unknown>) =>
    setForm((f) => ({
      ...f,
      kras: (f.kras ?? []).map((row, i) =>
        i === kraIdx
          ? { ...row, kpis: (row.kpis ?? []).map((k, j) => (j === kpiIdx ? { ...k, ...patch } : k)) }
          : row,
      ),
    }));

  const addKpi = (kraIdx: number) =>
    setForm((f) => ({
      ...f,
      kras: (f.kras ?? []).map((row, i) =>
        i === kraIdx
          ? { ...row, kpis: [...(row.kpis ?? []), { name: '', targetValue: '', unit: '', weightPercent: 0 }] }
          : row,
      ),
    }));

  const removeKpi = (kraIdx: number, kpiIdx: number) =>
    setForm((f) => ({
      ...f,
      kras: (f.kras ?? []).map((row, i) =>
        i === kraIdx ? { ...row, kpis: (row.kpis ?? []).filter((_, j) => j !== kpiIdx) } : row,
      ),
    }));

  const addCompetency = () =>
    setForm((f) => ({
      ...f,
      competencies: [...(f.competencies ?? []), { name: '', requiredLevel: 3 }],
    }));

  const removeCompetency = (idx: number) =>
    setForm((f) => ({ ...f, competencies: (f.competencies ?? []).filter((_, i) => i !== idx) }));

  return (
    <div className="dashboard-surface space-y-5 p-5 shadow-sm sm:p-6">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm md:col-span-2">
          <span className="text-neutral-500">Role title</span>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="text-neutral-500">Grade</span>
          <input
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
            value={form.grade ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
          />
        </label>
        <label className="text-sm md:col-span-3">
          <span className="text-neutral-500">Division</span>
          <StrideSelect
            value={form.divisionId ?? ''}
            onChange={(value) => setForm((f) => ({ ...f, divisionId: value || null }))}
            options={[
              { value: '', label: '—' },
              ...divisions.map((d) => ({ value: d.id, label: d.name })),
            ]}
            ariaLabel="Division"
            className="mt-1 w-full"
          />
        </label>
      </div>

      {SECTION_FIELDS.map(([key, label]) => (
        <label key={key} className="block text-sm">
          <span className="text-neutral-500">{label}</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
            value={(form[key] as string) ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        </label>
      ))}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">KRAs &amp; KPIs (Balanced Scorecard)</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              kraWeightOk
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            KRA weight total: {kraWeightTotal}%{kraWeightOk ? '' : ' (should be 100%)'}
          </span>
        </div>
        {kras.map((kra, kraIdx) => (
          <div key={kraIdx} className="space-y-2 rounded-xl border border-neutral-200 p-3">
            <div className="flex items-start gap-2">
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium"
                placeholder="Key result area"
                value={kra.title}
                onChange={(e) => updateKra(kraIdx, { title: e.target.value })}
              />
              <button
                type="button"
                aria-label="Remove KRA"
                className="shrink-0 rounded-lg border border-neutral-200 p-2 text-neutral-500 hover:bg-neutral-50 hover:text-red-600"
                onClick={() => removeKra(kraIdx)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
              <StrideSelect
                value={kra.bscPerspective ?? ''}
                onChange={(value) => updateKra(kraIdx, { bscPerspective: (value || undefined) as never })}
                options={[
                  { value: '', label: 'Perspective' },
                  { value: 'financial', label: 'Financial' },
                  { value: 'customer', label: 'Customer / stakeholder' },
                  { value: 'internal_process', label: 'Internal process' },
                  { value: 'learning_growth', label: 'Learning & growth' },
                ]}
                ariaLabel="Perspective"
              />
              <label className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="whitespace-nowrap">Weight %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={kra.weightPercent ?? 0}
                  onChange={(e) => updateKra(kraIdx, { weightPercent: Number(e.target.value) })}
                />
              </label>
            </div>
            {(kra.kpis ?? []).map((kpi, kpiIdx) => (
              <div key={kpiIdx} className="grid items-center gap-2 sm:grid-cols-[1fr_110px_90px_80px_auto]">
                <input
                  placeholder="KPI name"
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={kpi.name}
                  onChange={(e) => updateKpi(kraIdx, kpiIdx, { name: e.target.value })}
                />
                <input
                  placeholder="Target"
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={kpi.targetValue ?? ''}
                  onChange={(e) => updateKpi(kraIdx, kpiIdx, { targetValue: e.target.value })}
                />
                <input
                  placeholder="Unit"
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={kpi.unit ?? ''}
                  onChange={(e) => updateKpi(kraIdx, kpiIdx, { unit: e.target.value })}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="%"
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  value={kpi.weightPercent ?? 0}
                  onChange={(e) => updateKpi(kraIdx, kpiIdx, { weightPercent: Number(e.target.value) })}
                />
                <button
                  type="button"
                  aria-label="Remove KPI"
                  className="shrink-0 rounded-lg border border-neutral-200 p-2 text-neutral-500 hover:bg-neutral-50 hover:text-red-600"
                  onClick={() => removeKpi(kraIdx, kpiIdx)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
              onClick={() => addKpi(kraIdx)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add KPI
            </button>
          </div>
        ))}
        <button type="button" className="btn-secondary inline-flex items-center gap-2 text-sm" onClick={addKra}>
          <Plus className="h-4 w-4" />
          Add KRA
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Competencies (required level 1–5)</h2>
        {(form.competencies ?? []).map((c, idx) => (
          <div key={idx} className="grid items-center gap-2 sm:grid-cols-[1fr_120px_auto]">
            <input
              className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              placeholder="Competency"
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
            <button
              type="button"
              aria-label="Remove competency"
              className="shrink-0 rounded-lg border border-neutral-200 p-2 text-neutral-500 hover:bg-neutral-50 hover:text-red-600"
              onClick={() => removeCompetency(idx)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2 text-sm"
          onClick={addCompetency}
        >
          <Plus className="h-4 w-4" />
          Add competency
        </button>
      </div>
    </div>
  );
}
