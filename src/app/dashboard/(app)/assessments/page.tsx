'use client';

import { useEffect, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type Template = {
  id: string;
  name: string;
  description: string | null;
  timeLimitMinutes: number;
  questionCount: number;
  jobAssignmentCount: number;
};

type Job = { id: string; title: string; company: string };

export default function AssessmentsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('30');
  const [mcqPrompt, setMcqPrompt] = useState('Which payroll statutory deduction applies to employment income in Kenya?');
  const [mcqOptions, setMcqOptions] = useState('PAYE,NSSF,VAT,CORPORATE_TAX');
  const [mcqCorrect, setMcqCorrect] = useState('PAYE');
  const [assignJobId, setAssignJobId] = useState('');
  const [assignTemplateId, setAssignTemplateId] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [templatesRes, jobsRes] = await Promise.all([
        fetch('/api/assessments/templates', { cache: 'no-store' }),
        fetch('/api/jobs', { cache: 'no-store' }),
      ]);
      const templatesJson = await templatesRes.json();
      const jobsJson = await jobsRes.json();
      if (!templatesRes.ok) throw new Error(templatesJson.error || 'Failed to load templates');
      if (!jobsRes.ok) throw new Error(jobsJson.error || 'Failed to load jobs');
      setTemplates(Array.isArray(templatesJson) ? templatesJson : []);
      setJobs(Array.isArray(jobsJson) ? jobsJson : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const options = mcqOptions.split(',').map((o) => o.trim()).filter(Boolean);
    const res = await fetch('/api/assessments/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        timeLimitMinutes: Number(timeLimitMinutes) || 30,
        questions: [
          {
            type: 'mcq',
            prompt: mcqPrompt,
            options,
            correctAnswer: { value: mcqCorrect },
            maxPoints: 1,
          },
          {
            type: 'numeric',
            prompt: 'How many days of annual leave are commonly granted under Kenyan employment practice (minimum benchmark)?',
            correctAnswer: { value: 21 },
            maxPoints: 1,
          },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to create template');
      return;
    }
    setName('');
    setDescription('');
    await load();
  }

  async function assignTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!assignJobId || !assignTemplateId) return;
    setError(null);
    const res = await fetch(`/api/jobs/${encodeURIComponent(assignJobId)}/assessments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: assignTemplateId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to assign assessment');
      return;
    }
    await load();
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Assessment library"
        description="Create MCQ/numeric tests, assign them to jobs, and review scores on candidate applications."
      />
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5">
          <h2 className="text-sm font-bold text-[var(--dash-ink)]">New template</h2>
          <form onSubmit={createTemplate} className="mt-4 space-y-3">
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} required />
            <textarea className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Time limit (minutes)" value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(e.target.value)} />
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Sample MCQ prompt" value={mcqPrompt} onChange={(e) => setMcqPrompt(e.target.value)} />
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="MCQ options (comma-separated)" value={mcqOptions} onChange={(e) => setMcqOptions(e.target.value)} />
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Correct option" value={mcqCorrect} onChange={(e) => setMcqCorrect(e.target.value)} />
            <button type="submit" className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-bold text-white">Create template</button>
          </form>
        </section>
        <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5">
          <h2 className="text-sm font-bold text-[var(--dash-ink)]">Assign to job</h2>
          <form onSubmit={assignTemplate} className="mt-4 space-y-3">
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={assignTemplateId} onChange={(e) => setAssignTemplateId(e.target.value)} required>
              <option value="">Select template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={assignJobId} onChange={(e) => setAssignJobId(e.target.value)} required>
              <option value="">Select job</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title} — {j.company}</option>
              ))}
            </select>
            <button type="submit" className="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-sm font-semibold">Assign (on apply)</button>
          </form>
        </section>
      </div>
      <section className="mt-6 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5">
        <h2 className="text-sm font-bold text-[var(--dash-ink)]">Templates</h2>
        {loading ? (
          <p className="mt-3 text-sm text-[var(--dash-muted)]">Loading…</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {templates.length === 0 ? (
              <li className="text-sm text-[var(--dash-muted)]">No templates yet.</li>
            ) : (
              templates.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-[var(--dash-muted)]">{t.questionCount} questions · {t.timeLimitMinutes} min · {t.jobAssignmentCount} job(s)</span>
                </li>
              ))
            )}
          </ul>
        )}
      </section>
    </DashboardPage>
  );
}
