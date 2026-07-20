'use client';

import { useCallback, useEffect, useState } from 'react';

type Answer = {
  questionId: string;
  question: string;
  type: string;
  maxPoints: number;
  answer: { value?: unknown } | null;
  filePath: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  timeSpentSeconds: number | null;
  gradedAt: string | null;
};

type Attempt = {
  id: string;
  kind: 'native';
  templateName: string;
  templateKind: string;
  status: string;
  scorePercent: number | null;
  passed: boolean | null;
  earnedPoints: number | null;
  maxPoints: number | null;
  fitScore: number | null;
  dimensionScores: { dimensions?: Record<string, number>; percentile?: number; sten?: number } | null;
  integrityScore: number | null;
  integrityFlags: string[] | null;
  tabSwitchCount: number | null;
  integrityEventCount: number;
  needsManualGrading: boolean;
  submittedAt: string | null;
  clientIp: string | null;
  accessUrl: string;
  answers: Answer[];
};

type Invite = {
  id: string;
  kind: 'external';
  name: string;
  provider: string;
  connectionLabel: string;
  status: string;
  scorePercent: number | null;
  normalizedResult: { dimensions?: Record<string, number> } | null;
  candidateUrl: string | null;
  invitedAt: string | null;
  completedAt: string | null;
};

type ApiResponse = { attempts: Attempt[]; externalInvites: Invite[] };

export function ApplicationAssessmentsPanel({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<ApiResponse>({ attempts: [], externalInvites: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/assessments`, { cache: 'no-store' });
    const json = res.ok ? await res.json() : { attempts: [], externalInvites: [] };
    setData({ attempts: json.attempts ?? [], externalInvites: json.externalInvites ?? [] });
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return null;
  if (data.attempts.length === 0 && data.externalInvites.length === 0) return null;

  return (
    <section className="mt-6 border-t border-neutral-200 pt-4">
      <h3 className="text-sm font-semibold text-neutral-900">Assessments</h3>
      <div className="mt-2 space-y-3">
        {data.attempts.map((attempt) => (
          <NativeAttemptCard key={attempt.id} applicationId={applicationId} attempt={attempt} onGraded={load} />
        ))}
        {data.externalInvites.map((invite) => (
          <ExternalInviteCard key={invite.id} invite={invite} onChanged={load} />
        ))}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'submitted'
      ? 'bg-green-50 text-green-700'
      : status === 'awaiting_review'
        ? 'bg-amber-50 text-amber-700'
        : status === 'in_progress'
          ? 'bg-blue-50 text-blue-700'
          : status === 'completed'
            ? 'bg-green-50 text-green-700'
            : 'bg-neutral-100 text-neutral-600';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>{status.replace(/_/g, ' ')}</span>;
}

function NativeAttemptCard({ applicationId, attempt, onGraded }: { applicationId: string; attempt: Attempt; onGraded: () => void }) {
  const [expanded, setExpanded] = useState(attempt.needsManualGrading);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const ungraded = attempt.answers.filter((a) => a.isCorrect === null && a.maxPoints > 0);

  async function submitGrades() {
    setSaving(true);
    await fetch(`/api/applications/${encodeURIComponent(applicationId)}/assessments/${attempt.id}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grades: Object.entries(grades).map(([questionId, pointsAwarded]) => ({ questionId, pointsAwarded })),
      }),
    });
    setSaving(false);
    onGraded();
  }

  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-900">{attempt.templateName}</span>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">{attempt.templateKind}</span>
          <StatusPill status={attempt.status} />
        </div>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs text-neutral-500 hover:underline">
          {expanded ? 'Hide' : 'Details'}
        </button>
      </div>

      {attempt.status === 'submitted' || attempt.status === 'awaiting_review' ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-neutral-600">
          <Metric label="Score" value={`${attempt.scorePercent ?? 0}% (${attempt.earnedPoints ?? 0}/${attempt.maxPoints ?? 0})`} />
          {attempt.passed != null ? <Metric label="Result" value={attempt.passed ? 'Pass' : 'Fail'} tone={attempt.passed ? 'good' : 'bad'} /> : null}
          {attempt.fitScore != null ? <Metric label="Fit" value={`${attempt.fitScore}%`} /> : null}
          {attempt.integrityScore != null ? (
            <Metric label="Integrity" value={`${attempt.integrityScore}%`} tone={attempt.integrityScore < 70 ? 'bad' : undefined} />
          ) : null}
          {attempt.integrityEventCount > 0 ? <Metric label="Flags" value={String(attempt.integrityEventCount)} /> : null}
        </div>
      ) : (
        <a href={attempt.accessUrl} className="mt-1 inline-block text-[var(--brand-primary)] hover:underline">Candidate link</a>
      )}

      {attempt.integrityFlags && attempt.integrityFlags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {attempt.integrityFlags.map((flag) => (
            <span key={flag} className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-600">{flag}</span>
          ))}
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3">
          {attempt.dimensionScores?.dimensions ? (
            <div>
              <p className="mb-1 text-xs font-semibold text-neutral-500">Dimension scores</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(attempt.dimensionScores.dimensions).map(([dim, score]) => (
                  <span key={dim} className="rounded-lg bg-neutral-50 px-2 py-1 text-xs">
                    <span className="text-neutral-500">{dim}:</span> <span className="font-medium">{score}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {attempt.answers.map((ans) => (
              <div key={ans.questionId} className="rounded-md bg-neutral-50 px-2.5 py-2">
                {/<[a-z][\s\S]*>/i.test(ans.question) ? (
                  <div className="prose prose-sm max-w-none text-xs font-medium text-neutral-700 [&_p]:m-0" dangerouslySetInnerHTML={{ __html: ans.question }} />
                ) : (
                  <p className="text-xs font-medium text-neutral-700">{ans.question}</p>
                )}
                <p className="mt-0.5 text-xs text-neutral-600">
                  {ans.filePath ? (
                    <a href={ans.filePath} target="_blank" rel="noreferrer" className="text-[var(--brand-primary)] hover:underline">View upload</a>
                  ) : (
                    <span className="whitespace-pre-wrap">{formatAnswer(ans.answer)}</span>
                  )}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
                  {ans.isCorrect === null && ans.maxPoints > 0 ? (
                    <label className="flex items-center gap-1">
                      Award:
                      <input
                        type="number"
                        min={0}
                        max={ans.maxPoints}
                        className="w-16 rounded border border-neutral-300 px-1.5 py-0.5"
                        value={grades[ans.questionId] ?? ''}
                        onChange={(e) => setGrades((prev) => ({ ...prev, [ans.questionId]: Number(e.target.value) }))}
                      />
                      / {ans.maxPoints}
                    </label>
                  ) : (
                    <span>{ans.pointsAwarded ?? 0}/{ans.maxPoints} pts{ans.isCorrect === true ? ' ✓' : ans.isCorrect === false ? ' ✗' : ''}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {ungraded.length > 0 ? (
            <button type="button" onClick={submitGrades} disabled={saving} className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving…' : 'Save grades'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ExternalInviteCard({ invite, onChanged }: { invite: Invite; onChanged: () => void }) {
  const [sending, setSending] = useState(false);
  async function send() {
    setSending(true);
    await fetch(`/api/assessments/external-invites/${invite.id}/send`, { method: 'POST' });
    setSending(false);
    onChanged();
  }
  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-900">{invite.name}</span>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500">{invite.provider}</span>
          <StatusPill status={invite.status} />
        </div>
        {invite.status === 'pending' ? (
          <button type="button" onClick={send} disabled={sending} className="rounded-lg bg-[var(--brand-primary)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">
            {sending ? 'Sending…' : 'Send invite'}
          </button>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-neutral-600">
        {invite.scorePercent != null ? <Metric label="Score" value={`${invite.scorePercent}%`} /> : null}
        {invite.candidateUrl ? (
          <a href={invite.candidateUrl} target="_blank" rel="noreferrer" className="text-[var(--brand-primary)] hover:underline">Candidate link</a>
        ) : null}
      </div>
      {invite.normalizedResult?.dimensions ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(invite.normalizedResult.dimensions).map(([dim, score]) => (
            <span key={dim} className="rounded-lg bg-neutral-50 px-2 py-1 text-xs"><span className="text-neutral-500">{dim}:</span> <span className="font-medium">{score}</span></span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : 'text-neutral-900';
  return (
    <span className="text-xs">
      <span className="text-neutral-500">{label}: </span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </span>
  );
}

function formatAnswer(answer: { value?: unknown } | null): string {
  if (!answer || answer.value == null) return '—';
  const v = answer.value;
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
