'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Library, Plug, BarChart3, Plus, Pencil, Copy, Archive, Link2 } from 'lucide-react';
import { DashboardPage, DashboardPageHeader } from '@/components/dashboard/DashboardPage';
import { StrideSelect } from '@/components/ui/stride-select';
import { AssessmentBuilder } from '@/components/dashboard/assessments/AssessmentBuilder';
import { IntegrationsPanel } from '@/components/dashboard/assessments/IntegrationsPanel';
import { AnalyticsPanel } from '@/components/dashboard/assessments/AnalyticsPanel';
import { QuestionBankPanel } from '@/components/dashboard/assessments/QuestionBankPanel';
import {
  emptyTemplate,
  newClientKey,
  type BuilderQuestion,
  type BuilderTemplate,
} from '@/components/dashboard/assessments/builder-types';

type ApiTemplate = {
  id: string;
  name: string;
  description: string | null;
  kind: BuilderTemplate['kind'];
  category: string | null;
  timeLimitMinutes: number;
  passingScorePercent: number | null;
  shuffleSections: boolean;
  shuffleQuestions: boolean;
  negativeMarking: boolean;
  showResultsToCandidate: boolean;
  requireConsent: boolean;
  requireWebcam: boolean;
  lockdown: boolean;
  retentionDays: number | null;
  questionCount: number;
  jobAssignmentCount: number;
  attemptCount: number;
  sections: Array<{ id: string; title: string; description: string | null; timeLimitMinutes: number | null; shuffleQuestions: boolean; pickCount: number | null }>;
  questions: Array<{ id: string; sectionId: string | null; type: BuilderQuestion['type']; prompt: string; options: unknown; correctAnswer: unknown; scoring: unknown; explanation: string | null; mediaUrl: string | null; difficulty: BuilderQuestion['difficulty']; weight: number; maxPoints: number; required: boolean }>;
};

type Job = { id: string; title: string };
type ExternalAssessment = { id: string; name: string; provider: string };
type BankItem = { id: string; type: BuilderQuestion['type']; prompt: string; options: unknown; correctAnswer: unknown; scoring: unknown; defaultPoints: number; difficulty: BuilderQuestion['difficulty'] };

type Tab = 'library' | 'bank' | 'integrations' | 'analytics';

const TABS: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: 'library', label: 'Library', icon: FileText },
  { id: 'bank', label: 'Question bank', icon: Library },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export default function AssessmentsPage() {
  const [tab, setTab] = useState<Tab>('library');
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [externals, setExternals] = useState<ExternalAssessment[]>([]);
  const [bankItems, setBankItems] = useState<BankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BuilderTemplate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, jRes, eRes, bRes] = await Promise.all([
      fetch('/api/assessments/templates', { cache: 'no-store' }),
      fetch('/api/jobs', { cache: 'no-store' }),
      fetch('/api/assessments/external', { cache: 'no-store' }),
      fetch('/api/assessments/question-bank', { cache: 'no-store' }),
    ]);
    setTemplates(tRes.ok ? await tRes.json() : []);
    const jData = jRes.ok ? await jRes.json() : [];
    setJobs(Array.isArray(jData) ? jData : jData.jobs ?? []);
    setExternals(eRes.ok ? await eRes.json() : []);
    setBankItems(bRes.ok ? await bRes.json() : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function editTemplate(t: ApiTemplate) {
    setEditing(apiToBuilder(t));
    setTab('library');
  }

  async function duplicate(id: string) {
    await fetch(`/api/assessments/templates/${id}/duplicate`, { method: 'POST' });
    void load();
  }

  async function archive(id: string) {
    if (!confirm('Archive this template? Existing attempts are kept.')) return;
    await fetch(`/api/assessments/templates/${id}`, { method: 'DELETE' });
    void load();
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Assessments"
        eyebrow="Recruitment"
        description="Build proctored native tests, connect global psychometric providers, and score candidates on competency fit."
        actions={
          tab === 'library' && !editing ? (
            <button type="button" onClick={() => setEditing(emptyTemplate())} className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> New template
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-1 border-b border-[var(--dash-border)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setEditing(null); }}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-[var(--dash-text-muted)] hover:text-[var(--dash-text-strong)]'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'library' ? (
        editing ? (
          <AssessmentBuilder
            initial={editing}
            bankItems={bankItems}
            onSaved={() => { setEditing(null); void load(); }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <LibraryTab
            loading={loading}
            templates={templates}
            jobs={jobs}
            externals={externals}
            onEdit={editTemplate}
            onDuplicate={duplicate}
            onArchive={archive}
          />
        )
      ) : null}

      {tab === 'bank' ? <QuestionBankPanel items={bankItems} onChanged={load} /> : null}
      {tab === 'integrations' ? <IntegrationsPanel /> : null}
      {tab === 'analytics' ? <AnalyticsPanel /> : null}
    </DashboardPage>
  );
}

function LibraryTab({
  loading,
  templates,
  jobs,
  externals,
  onEdit,
  onDuplicate,
  onArchive,
}: {
  loading: boolean;
  templates: ApiTemplate[];
  jobs: Job[];
  externals: ExternalAssessment[];
  onEdit: (t: ApiTemplate) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const [assignFor, setAssignFor] = useState<string | null>(null);

  if (loading) return <p className="text-sm text-[var(--dash-text-muted)]">Loading…</p>;

  return (
    <div className="space-y-4">
      {templates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--dash-border)] px-4 py-10 text-center text-sm text-[var(--dash-text-muted)]">
          No assessment templates yet. Create your first world-class assessment.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--dash-text-strong)]">{t.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--dash-text-muted)]">
                    {t.kind} · {t.questionCount} questions · {t.timeLimitMinutes}m
                    {t.passingScorePercent != null ? ` · pass ${t.passingScorePercent}%` : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--dash-surface-muted)] px-2 py-0.5 text-[11px] text-[var(--dash-text-muted)]">{t.attemptCount} attempts</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1">
                <button type="button" onClick={() => onEdit(t)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--dash-border)] px-2.5 py-1.5 text-xs font-medium"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                <button type="button" onClick={() => setAssignFor(assignFor === t.id ? null : t.id)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--dash-border)] px-2.5 py-1.5 text-xs font-medium"><Link2 className="h-3.5 w-3.5" /> Assign</button>
                <button type="button" onClick={() => onDuplicate(t.id)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--dash-border)] px-2.5 py-1.5 text-xs font-medium"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
                <button type="button" onClick={() => onArchive(t.id)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--dash-border)] px-2.5 py-1.5 text-xs font-medium text-red-500"><Archive className="h-3.5 w-3.5" /> Archive</button>
              </div>
              {assignFor === t.id ? <AssignRow templateId={t.id} jobs={jobs} onDone={() => setAssignFor(null)} /> : null}
            </div>
          ))}
        </div>
      )}

      <ExternalAssignSection jobs={jobs} externals={externals} />
    </div>
  );
}

function AssignRow({ templateId, jobs, onDone }: { templateId: string; jobs: Job[]; onDone: () => void }) {
  const [jobId, setJobId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function assign() {
    if (!jobId) return;
    setBusy(true);
    const res = await fetch(`/api/jobs/${jobId}/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId }),
    });
    setBusy(false);
    setMsg(res.ok ? 'Assigned.' : 'Failed to assign.');
    if (res.ok) setTimeout(onDone, 900);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--dash-surface-muted)] p-2">
      <div className="min-w-[12rem] flex-1">
        <StrideSelect value={jobId} onChange={setJobId} options={[{ value: '', label: 'Select job…' }, ...jobs.map((j) => ({ value: j.id, label: j.title }))]} ariaLabel="Job" size="sm" />
      </div>
      <button type="button" onClick={assign} disabled={!jobId || busy} className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Assign</button>
      {msg ? <span className="text-xs text-[var(--dash-text-muted)]">{msg}</span> : null}
    </div>
  );
}

function ExternalAssignSection({ jobs, externals }: { jobs: Job[]; externals: ExternalAssessment[] }) {
  const [jobId, setJobId] = useState('');
  const [externalId, setExternalId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  if (externals.length === 0) return null;

  async function assign() {
    if (!jobId || !externalId) return;
    const res = await fetch(`/api/jobs/${jobId}/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalAssessmentId: externalId }),
    });
    setMsg(res.ok ? 'External assessment assigned.' : 'Failed.');
  }

  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4">
      <h3 className="text-sm font-bold text-[var(--dash-text-strong)]">Assign external assessment</h3>
      <p className="text-xs text-[var(--dash-text-muted)]">Provider tests you have imported can be attached to a job like native templates.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[12rem] flex-1"><StrideSelect value={jobId} onChange={setJobId} options={[{ value: '', label: 'Select job…' }, ...jobs.map((j) => ({ value: j.id, label: j.title }))]} ariaLabel="Job" size="sm" /></div>
        <div className="min-w-[12rem] flex-1"><StrideSelect value={externalId} onChange={setExternalId} options={[{ value: '', label: 'Select assessment…' }, ...externals.map((e) => ({ value: e.id, label: `${e.name} (${e.provider})` }))]} ariaLabel="External assessment" size="sm" /></div>
        <button type="button" onClick={assign} disabled={!jobId || !externalId} className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Assign</button>
        {msg ? <span className="text-xs text-[var(--dash-text-muted)]">{msg}</span> : null}
      </div>
    </div>
  );
}

function apiToBuilder(t: ApiTemplate): BuilderTemplate {
  const sectionKeyById = new Map<string, string>();
  const sections = t.sections.map((s) => {
    const clientKey = newClientKey('section');
    sectionKeyById.set(s.id, clientKey);
    return {
      clientKey,
      title: s.title,
      description: s.description ?? '',
      timeLimitMinutes: s.timeLimitMinutes,
      shuffleQuestions: s.shuffleQuestions,
      pickCount: s.pickCount,
    };
  });

  const questions: BuilderQuestion[] = t.questions.map((q) => ({
    clientKey: newClientKey('q'),
    sectionKey: q.sectionId ? sectionKeyById.get(q.sectionId) ?? null : null,
    type: q.type,
    prompt: q.prompt,
    options: normalizeOptions(q.options),
    correctAnswer: q.correctAnswer,
    scoring: (q.scoring as BuilderQuestion['scoring']) ?? null,
    explanation: q.explanation ?? '',
    mediaUrl: q.mediaUrl,
    difficulty: q.difficulty,
    weight: q.weight,
    maxPoints: q.maxPoints,
    required: q.required,
  }));

  return {
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    kind: t.kind,
    category: t.category ?? '',
    timeLimitMinutes: t.timeLimitMinutes,
    passingScorePercent: t.passingScorePercent,
    shuffleSections: t.shuffleSections,
    shuffleQuestions: t.shuffleQuestions,
    negativeMarking: t.negativeMarking,
    showResultsToCandidate: t.showResultsToCandidate,
    requireConsent: t.requireConsent,
    requireWebcam: t.requireWebcam,
    lockdown: t.lockdown,
    retentionDays: t.retentionDays,
    sections,
    questions,
  };
}

function normalizeOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [];
}
