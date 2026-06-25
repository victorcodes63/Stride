'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type AssessmentQuestion = {
  id: string;
  type: 'mcq' | 'numeric' | 'file';
  prompt: string;
  options?: string[] | null;
  maxPoints: number;
};

type AssessmentPayload = {
  status: string;
  jobTitle?: string;
  company?: string;
  templateName?: string;
  description?: string | null;
  timeLimitMinutes?: number;
  expiresAt?: string | null;
  scorePercent?: number | null;
  questions?: AssessmentQuestion[];
  error?: string;
};

export default function CareersAssessmentPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';
  const [payload, setPayload] = useState<AssessmentPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/careers/assessment/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json()) as AssessmentPayload;
        if (!res.ok) throw new Error(data.error || 'Unable to load assessment');
        setPayload(data);
      })
      .catch((e) => setMessage(e instanceof Error ? e.message : 'Unable to load assessment'));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !payload?.questions) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/careers/assessment/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answers: payload.questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' })),
      }),
    });
    const data = (await res.json()) as AssessmentPayload;
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || 'Submission failed');
      return;
    }
    setPayload((prev) => ({ ...(prev ?? {}), status: 'submitted', scorePercent: data.scorePercent ?? null }));
  }

  if (message && !payload) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-neutral-600">{message}</main>;
  }
  if (!payload) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-neutral-500">Loading assessment…</main>;
  }
  if (payload.status === 'submitted') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-neutral-900">Assessment submitted</h1>
        <p className="mt-3 text-neutral-600">
          Thank you. Your score: {payload.scorePercent ?? 0}% for {payload.jobTitle} at {payload.company}.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-[var(--pub-primary,#ff5436)]">Stride assessment</p>
      <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{payload.templateName}</h1>
      <p className="mt-1 text-sm text-neutral-600">{payload.jobTitle} · {payload.company}</p>
      {payload.description ? <p className="mt-3 text-sm text-neutral-600">{payload.description}</p> : null}
      <p className="mt-2 text-xs text-neutral-500">Time limit: {payload.timeLimitMinutes} minutes · One attempt only</p>
      <form onSubmit={submit} className="mt-8 space-y-6">
        {payload.questions?.map((q, index) => (
          <fieldset key={q.id} className="rounded-xl border border-neutral-200 p-4">
            <legend className="px-1 text-sm font-medium text-neutral-900">
              {index + 1}. {q.prompt}
            </legend>
            {q.type === 'mcq' && Array.isArray(q.options) ? (
              <div className="mt-3 space-y-2">
                {q.options.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={q.id}
                      value={option}
                      checked={answers[q.id] === option}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: option }))}
                      required
                    />
                    {option}
                  </label>
                ))}
              </div>
            ) : (
              <input
                className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
                type={q.type === 'numeric' ? 'number' : 'text'}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                required
              />
            )}
          </fieldset>
        ))}
        <button type="submit" disabled={busy} className="rounded-lg bg-[var(--pub-primary,#ff5436)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {busy ? 'Submitting…' : 'Submit assessment'}
        </button>
      </form>
    </main>
  );
}
