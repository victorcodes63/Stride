'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type QType =
  | 'mcq'
  | 'multi_select'
  | 'numeric'
  | 'short_text'
  | 'long_text'
  | 'code'
  | 'file'
  | 'likert'
  | 'rating'
  | 'ranking'
  | 'situational'
  | 'video_response';

type Question = {
  id: string;
  sectionId: string | null;
  type: QType;
  prompt: string;
  options?: string[] | null;
  mediaUrl?: string | null;
  maxPoints: number;
  required: boolean;
  scale?: number | null;
  savedAnswer?: { value: unknown } | null;
};

type Section = { id: string; title: string; description: string | null; timeLimitMinutes: number | null };

type Payload = {
  status: 'loading' | 'not_started' | 'in_progress' | 'submitted' | 'expired';
  jobTitle?: string;
  company?: string;
  templateName?: string;
  description?: string | null;
  timeLimitMinutes?: number;
  requireConsent?: boolean;
  requireWebcam?: boolean;
  lockdown?: boolean;
  showResultsToCandidate?: boolean;
  needsConsent?: boolean;
  sectionCount?: number;
  questionCount?: number;
  expiresAt?: string | null;
  sections?: Section[];
  questions?: Question[];
  scorePercent?: number | null;
  error?: string;
};

type AnswerValue = string | string[] | number | null;

export default function CareersAssessmentPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';
  const [payload, setPayload] = useState<Payload | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/careers/assessment/${encodeURIComponent(token)}`, { cache: 'no-store' });
    const data = (await res.json()) as Payload;
    if (!res.ok && !data.status) {
      setMessage(data.error || 'Unable to load assessment');
      return;
    }
    setPayload(data);
    if (data.questions) {
      const initial: Record<string, AnswerValue> = {};
      for (const q of data.questions) {
        const saved = q.savedAnswer?.value;
        if (saved !== undefined && saved !== null) initial[q.id] = saved as AnswerValue;
      }
      setAnswers((prev) => ({ ...initial, ...prev }));
    }
  }, [token]);

  useEffect(() => {
    if (token) void reload();
  }, [token, reload]);

  // Overall countdown timer.
  useEffect(() => {
    if (payload?.status !== 'in_progress' || !payload.expiresAt) return;
    const expiry = new Date(payload.expiresAt).getTime();
    const tick = () => setRemainingMs(Math.max(0, expiry - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [payload?.status, payload?.expiresAt]);

  const submit = useCallback(
    async (auto = false) => {
      if (!payload?.questions) return;
      setBusy(true);
      const body = {
        answers: payload.questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? null })),
      };
      const res = await fetch(`/api/careers/assessment/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as Payload & { awaitingReview?: boolean };
      setBusy(false);
      if (!res.ok) {
        if (!auto) setMessage(data.error || 'Submission failed');
        return;
      }
      setPayload((prev) => ({ ...(prev ?? { status: 'submitted' }), status: 'submitted', scorePercent: data.scorePercent ?? null }));
    },
    [answers, payload, token],
  );

  // Auto-submit when the timer hits zero.
  useEffect(() => {
    if (remainingMs === 0 && payload?.status === 'in_progress') void submit(true);
  }, [remainingMs, payload?.status, submit]);

  // Autosave (debounced).
  const answersRef = useRef(answers);
  answersRef.current = answers;
  useEffect(() => {
    if (payload?.status !== 'in_progress' || !payload.questions) return;
    const id = setTimeout(() => {
      const rows = Object.entries(answersRef.current).map(([questionId, answer]) => ({ questionId, answer }));
      if (rows.length === 0) return;
      void fetch(`/api/careers/assessment/${encodeURIComponent(token)}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: rows }),
      });
    }, 1500);
    return () => clearTimeout(id);
  }, [answers, payload?.status, payload?.questions, token]);

  useProctoring({
    token,
    active: payload?.status === 'in_progress',
    lockdown: Boolean(payload?.lockdown),
    requireWebcam: Boolean(payload?.requireWebcam),
  });

  async function start() {
    setBusy(true);
    const res = await fetch(`/api/careers/assessment/${encodeURIComponent(token)}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent, locale: typeof navigator !== 'undefined' ? navigator.language : undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || 'Could not start assessment');
      return;
    }
    if (payload?.lockdown) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        /* user can still proceed */
      }
    }
    await reload();
  }

  if (message && !payload) {
    return <Shell><p className="text-center text-sm text-neutral-600">{message}</p></Shell>;
  }
  if (!payload) {
    return <Shell><p className="text-center text-sm text-neutral-500">Loading assessment…</p></Shell>;
  }
  if (payload.status === 'expired') {
    return <Shell><h1 className="text-2xl font-semibold text-neutral-900">Assessment closed</h1><p className="mt-2 text-neutral-600">The time limit for this assessment has passed.</p></Shell>;
  }
  if (payload.status === 'submitted') {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold text-neutral-900">Assessment submitted</h1>
        <p className="mt-3 text-neutral-600">
          Thank you for completing the {payload.templateName} for {payload.jobTitle} at {payload.company}.
          {payload.scorePercent != null ? ` Your score: ${payload.scorePercent}%.` : ' Our team will review your responses.'}
        </p>
      </Shell>
    );
  }
  if (payload.status === 'not_started') {
    return (
      <ConsentScreen
        payload={payload}
        consent={consent}
        setConsent={setConsent}
        onStart={start}
        busy={busy}
        message={message}
      />
    );
  }

  // in_progress
  const sections = payload.sections ?? [];
  const questions = payload.questions ?? [];
  const grouped = groupBySection(questions, sections);
  const currentGroup = grouped[activeSection] ?? grouped[0];
  const answeredCount = questions.filter((q) => hasAnswer(answers[q.id])).length;
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="sticky top-0 z-10 -mx-4 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-neutral-900">{payload.templateName}</h1>
            <p className="truncate text-xs text-neutral-500">{payload.jobTitle} · {payload.company}</p>
          </div>
          {remainingMs != null ? (
            <div className={`rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums ${remainingMs < 60000 ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-700'}`} aria-live="polite">
              {formatTime(remainingMs)}
            </div>
          ) : null}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-[var(--pub-primary,#ff5436)] transition-all" style={{ width: `${progress}%` }} />
        </div>
        {sections.length > 1 ? (
          <nav className="mt-2 flex flex-wrap gap-1" aria-label="Sections">
            {grouped.map((g, i) => (
              <button
                key={g.section?.id ?? `s-${i}`}
                type="button"
                onClick={() => setActiveSection(i)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${i === activeSection ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}
              >
                {g.section?.title ?? 'Questions'}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      {message ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{message}</p> : null}

      <div className="mt-6 space-y-6">
        {currentGroup?.section?.description ? (
          <p className="rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-600">{currentGroup.section.description}</p>
        ) : null}
        {currentGroup?.questions.map((q, index) => (
          <QuestionField
            key={q.id}
            token={token}
            question={q}
            index={index}
            value={answers[q.id] ?? null}
            onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          disabled={activeSection === 0}
          onClick={() => setActiveSection((s) => Math.max(0, s - 1))}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Previous
        </button>
        {activeSection < grouped.length - 1 ? (
          <button type="button" onClick={() => setActiveSection((s) => s + 1)} className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-semibold text-white">
            Next section
          </button>
        ) : (
          <button type="button" onClick={() => submit(false)} disabled={busy} className="rounded-lg bg-[var(--pub-primary,#ff5436)] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {busy ? 'Submitting…' : 'Submit assessment'}
          </button>
        )}
      </div>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl px-4 py-16">{children}</main>;
}

/** Renders question prompts authored as rich HTML by staff, or plain text otherwise. */
function Prompt({ html }: { html: string }) {
  if (/<[a-z][\s\S]*>/i.test(html)) {
    return <span className="prose prose-sm inline max-w-none [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <span>{html}</span>;
}

function ConsentScreen({
  payload,
  consent,
  setConsent,
  onStart,
  busy,
  message,
}: {
  payload: Payload;
  consent: boolean;
  setConsent: (v: boolean) => void;
  onStart: () => void;
  busy: boolean;
  message: string | null;
}) {
  const canStart = !payload.needsConsent || consent;
  return (
    <Shell>
      <p className="text-xs uppercase tracking-wide text-[var(--pub-primary,#ff5436)]">Stride assessment</p>
      <h1 className="mt-2 text-2xl font-semibold text-neutral-900">{payload.templateName}</h1>
      <p className="mt-1 text-sm text-neutral-600">{payload.jobTitle} · {payload.company}</p>
      {payload.description ? <p className="mt-3 text-sm text-neutral-600">{payload.description}</p> : null}

      <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <Info label="Time limit" value={`${payload.timeLimitMinutes} minutes`} />
        <Info label="Questions" value={String(payload.questionCount ?? 0)} />
        {payload.sectionCount ? <Info label="Sections" value={String(payload.sectionCount)} /> : null}
        <Info label="Attempts" value="One only" />
      </dl>

      {(payload.lockdown || payload.requireWebcam) ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">This is a proctored assessment.</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {payload.lockdown ? <li>Fullscreen is enforced; copy/paste and leaving the tab are recorded.</li> : null}
            {payload.requireWebcam ? <li>Your webcam will capture periodic snapshots for identity verification.</li> : null}
          </ul>
        </div>
      ) : null}

      {payload.needsConsent ? (
        <label className="mt-5 flex items-start gap-2 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>
            I consent to Stride and the hiring organisation processing my responses{payload.requireWebcam ? ' and webcam images' : ''} for this
            recruitment assessment, in line with applicable data-protection law (Kenya DPA / GDPR). I understand my data is retained only as long as necessary.
          </span>
        </label>
      ) : null}

      {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}

      <button
        type="button"
        onClick={onStart}
        disabled={!canStart || busy}
        className="mt-6 rounded-lg bg-[var(--pub-primary,#ff5436)] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? 'Starting…' : 'Begin assessment'}
      </button>
    </Shell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-2">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function QuestionField({
  token,
  question,
  index,
  value,
  onChange,
}: {
  token: string;
  question: Question;
  index: number;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const q = question;
  return (
    <fieldset className="rounded-xl border border-neutral-200 p-4">
      <legend className="px-1 text-sm font-medium text-neutral-900">
        <span className="inline-flex flex-wrap items-baseline gap-1">
          <span>{index + 1}.</span>
          <Prompt html={q.prompt} />
          {q.required ? <span className="text-red-500">*</span> : null}
        </span>
      </legend>
      {q.mediaUrl ? (
        <img src={q.mediaUrl} alt="" className="mb-3 max-h-56 rounded-md" />
      ) : null}
      <AnswerInput token={token} question={q} value={value} onChange={onChange} />
    </fieldset>
  );
}

function AnswerInput({
  token,
  question,
  value,
  onChange,
}: {
  token: string;
  question: Question;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const q = question;

  if (q.type === 'mcq' && Array.isArray(q.options)) {
    return (
      <div className="mt-3 space-y-2">
        {q.options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input type="radio" name={q.id} value={option} checked={value === option} onChange={() => onChange(option)} />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (q.type === 'multi_select' && Array.isArray(q.options)) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="mt-3 space-y-2">
        {q.options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={(e) => onChange(e.target.checked ? [...selected, option] : selected.filter((o) => o !== option))}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (q.type === 'ranking' && Array.isArray(q.options)) {
    const order = Array.isArray(value) && value.length ? value : q.options;
    const move = (i: number, dir: -1 | 1) => {
      const next = [...order];
      const j = i + dir;
      if (j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j], next[i]];
      onChange(next);
    };
    return (
      <ol className="mt-3 space-y-2">
        {order.map((option, i) => (
          <li key={option} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm">
            <span>{i + 1}. {option}</span>
            <span className="flex gap-1">
              <button type="button" onClick={() => move(i, -1)} className="rounded px-2 py-0.5 text-neutral-500 hover:bg-neutral-100" aria-label="Move up">↑</button>
              <button type="button" onClick={() => move(i, 1)} className="rounded px-2 py-0.5 text-neutral-500 hover:bg-neutral-100" aria-label="Move down">↓</button>
            </span>
          </li>
        ))}
      </ol>
    );
  }

  if (q.type === 'likert' || q.type === 'rating') {
    const scale = q.scale ?? 5;
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: scale }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm ${value === n ? 'border-[var(--pub-primary,#ff5436)] bg-[var(--pub-primary,#ff5436)] text-white' : 'border-neutral-300 text-neutral-700'}`}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === 'situational' && Array.isArray(q.options)) {
    return (
      <div className="mt-3 space-y-2">
        {q.options.map((option, i) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input type="radio" name={q.id} checked={value === i + 1} onChange={() => onChange(i + 1)} />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (q.type === 'long_text' || q.type === 'code') {
    return (
      <textarea
        className={`mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm ${q.type === 'code' ? 'font-mono' : ''}`}
        rows={q.type === 'code' ? 8 : 5}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (q.type === 'file' || q.type === 'video_response') {
    return <UploadField token={token} kind="answer" accept={q.type === 'video_response' ? 'video/*' : undefined} value={typeof value === 'string' ? value : null} onChange={onChange} />;
  }

  return (
    <input
      className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      type={q.type === 'numeric' ? 'number' : 'text'}
      value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function UploadField({
  token,
  kind,
  accept,
  value,
  onChange,
}: {
  token: string;
  kind: string;
  accept?: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  async function upload(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const res = await fetch(`/api/careers/assessment/${encodeURIComponent(token)}/upload`, { method: 'POST', body: form });
    setUploading(false);
    const data = await res.json();
    if (res.ok && data.url) onChange(data.url);
  }
  return (
    <div className="mt-3">
      <input type="file" accept={accept} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="text-sm" />
      {uploading ? <p className="mt-1 text-xs text-neutral-500">Uploading…</p> : null}
      {value ? <p className="mt-1 text-xs text-green-600">Uploaded ✓</p> : null}
    </div>
  );
}

/** Lightweight proctoring: emits integrity events; enforces lockdown; webcam snapshots. */
function useProctoring({
  token,
  active,
  lockdown,
  requireWebcam,
}: {
  token: string;
  active: boolean;
  lockdown: boolean;
  requireWebcam: boolean;
}) {
  useEffect(() => {
    if (!active) return;
    const send = (type: string, detail?: unknown, mediaUrl?: string) =>
      void fetch(`/api/careers/assessment/${encodeURIComponent(token)}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, detail, mediaUrl }),
      }).catch(() => {});

    const onVisibility = () => send(document.hidden ? 'tab_blur' : 'tab_focus');
    const onCopy = () => send('copy');
    const onPaste = (e: ClipboardEvent) => {
      if (lockdown) {
        e.preventDefault();
        send('paste_blocked');
      } else {
        send('paste');
      }
    };
    const onContext = (e: MouseEvent) => {
      if (lockdown) e.preventDefault();
      send('right_click');
    };
    const onFullscreen = () => send(document.fullscreenElement ? 'fullscreen_enter' : 'fullscreen_exit');
    const onResize = () => send('window_resize');

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('resize', onResize);

    let stream: MediaStream | null = null;
    let snapshotTimer: ReturnType<typeof setInterval> | null = null;
    if (requireWebcam && navigator.mediaDevices?.getUserMedia) {
      const video = document.createElement('video');
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((s) => {
          stream = s;
          video.srcObject = s;
          void video.play();
          snapshotTimer = setInterval(async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            if (!ctx || video.videoWidth === 0) return;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(async (blob) => {
              if (!blob) return;
              const form = new FormData();
              form.append('file', blob, 'snapshot.png');
              form.append('kind', 'webcam');
              const res = await fetch(`/api/careers/assessment/${encodeURIComponent(token)}/upload`, { method: 'POST', body: form });
              const data = await res.json().catch(() => ({}));
              if (res.ok && data.url) send('webcam_snapshot', undefined, data.url);
            }, 'image/png');
          }, 60_000);
        })
        .catch(() => send('face_missing'));
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('resize', onResize);
      if (snapshotTimer) clearInterval(snapshotTimer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, lockdown, requireWebcam, token]);
}

function groupBySection(questions: Question[], sections: Section[]): Array<{ section: Section | null; questions: Question[] }> {
  if (sections.length === 0) return [{ section: null, questions }];
  const groups: Array<{ section: Section | null; questions: Question[] }> = sections.map((s) => ({ section: s, questions: [] }));
  const noSection: Question[] = [];
  for (const q of questions) {
    const g = groups.find((grp) => grp.section?.id === q.sectionId);
    if (g) g.questions.push(q);
    else noSection.push(q);
  }
  if (noSection.length) groups.push({ section: null, questions: noSection });
  return groups.filter((g) => g.questions.length > 0);
}

function hasAnswer(v: AnswerValue): boolean {
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
