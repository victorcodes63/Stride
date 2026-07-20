'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Eye, Save, Library } from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';
import { SortableQuestion } from './SortableQuestion';
import {
  emptyQuestion,
  emptyTemplate,
  newClientKey,
  type BuilderQuestion,
  type BuilderSection,
  type BuilderTemplate,
  type TemplateKind,
} from './builder-types';

type BankItem = {
  id: string;
  type: BuilderQuestion['type'];
  prompt: string;
  options: unknown;
  correctAnswer: unknown;
  scoring: unknown;
  defaultPoints: number;
  difficulty: BuilderQuestion['difficulty'];
};

const KIND_OPTIONS: Array<{ value: TemplateKind; label: string }> = [
  { value: 'skills', label: 'Skills / knowledge' },
  { value: 'cognitive', label: 'Cognitive ability' },
  { value: 'personality', label: 'Personality' },
  { value: 'situational', label: 'Situational judgement' },
  { value: 'mixed', label: 'Mixed' },
];

export function AssessmentBuilder({
  initial,
  bankItems,
  onSaved,
  onCancel,
}: {
  initial?: BuilderTemplate;
  bankItems: BankItem[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [template, setTemplate] = useState<BuilderTemplate>(initial ?? emptyTemplate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showBank, setShowBank] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const totalPoints = useMemo(
    () => template.questions.reduce((sum, q) => sum + (q.maxPoints || 0), 0),
    [template.questions],
  );

  function patch(update: Partial<BuilderTemplate>) {
    setTemplate((prev) => ({ ...prev, ...update }));
  }

  function updateQuestion(clientKey: string, qPatch: Partial<BuilderQuestion>) {
    setTemplate((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.clientKey === clientKey ? { ...q, ...qPatch } : q)),
    }));
  }

  function addQuestion(sectionKey: string | null) {
    setTemplate((prev) => ({ ...prev, questions: [...prev.questions, emptyQuestion(sectionKey)] }));
  }

  function addFromBank(item: BankItem) {
    const q: BuilderQuestion = {
      ...emptyQuestion(null),
      type: item.type,
      prompt: item.prompt,
      options: Array.isArray(item.options) ? (item.options as string[]) : normalizeToOptions(item.options),
      correctAnswer: item.correctAnswer,
      scoring: (item.scoring as BuilderQuestion['scoring']) ?? null,
      maxPoints: item.defaultPoints,
      difficulty: item.difficulty,
    };
    setTemplate((prev) => ({ ...prev, questions: [...prev.questions, q] }));
    setShowBank(false);
  }

  function removeQuestion(clientKey: string) {
    setTemplate((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.clientKey !== clientKey) }));
  }

  function duplicateQuestion(clientKey: string) {
    setTemplate((prev) => {
      const idx = prev.questions.findIndex((q) => q.clientKey === clientKey);
      if (idx < 0) return prev;
      const copy = { ...prev.questions[idx], clientKey: newClientKey('q') };
      const questions = [...prev.questions];
      questions.splice(idx + 1, 0, copy);
      return { ...prev, questions };
    });
  }

  function addSection() {
    const section: BuilderSection = {
      clientKey: newClientKey('section'),
      title: `Section ${template.sections.length + 1}`,
      description: '',
      timeLimitMinutes: null,
      shuffleQuestions: false,
      pickCount: null,
    };
    patch({ sections: [...template.sections, section] });
  }

  function updateSection(clientKey: string, sPatch: Partial<BuilderSection>) {
    patch({ sections: template.sections.map((s) => (s.clientKey === clientKey ? { ...s, ...sPatch } : s)) });
  }

  function removeSection(clientKey: string) {
    patch({
      sections: template.sections.filter((s) => s.clientKey !== clientKey),
      questions: template.questions.map((q) => (q.sectionKey === clientKey ? { ...q, sectionKey: null } : q)),
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTemplate((prev) => {
      const oldIndex = prev.questions.findIndex((q) => q.clientKey === active.id);
      const newIndex = prev.questions.findIndex((q) => q.clientKey === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return { ...prev, questions: arrayMove(prev.questions, oldIndex, newIndex) };
    });
  }

  async function save() {
    setError(null);
    if (!template.name.trim()) {
      setError('Template name is required.');
      return;
    }
    setSaving(true);
    const payload = {
      ...template,
      questions: template.questions.map((q, i) => ({ ...q, orderIndex: i })),
    };
    const url = template.id ? `/api/assessments/templates/${template.id}` : '/api/assessments/templates';
    const method = template.id ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to save template.');
      return;
    }
    onSaved();
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      {/* Settings */}
      <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Template name</span>
            <input className="w-full rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm" value={template.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Senior Accountant screening" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Type</span>
            <StrideSelect value={template.kind} onChange={(v) => patch({ kind: v as TemplateKind })} options={KIND_OPTIONS} ariaLabel="Kind" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Description</span>
            <textarea className="w-full rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm" rows={2} value={template.description} onChange={(e) => patch({ description: e.target.value })} />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <NumberField label="Time limit (min)" value={template.timeLimitMinutes} onChange={(v) => patch({ timeLimitMinutes: v ?? 30 })} />
          <NumberField label="Passing score %" value={template.passingScorePercent} onChange={(v) => patch({ passingScorePercent: v })} allowEmpty />
          <NumberField label="Data retention (days)" value={template.retentionDays} onChange={(v) => patch({ retentionDays: v })} allowEmpty />
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Toggle label="Shuffle sections" checked={template.shuffleSections} onChange={(v) => patch({ shuffleSections: v })} />
          <Toggle label="Shuffle questions" checked={template.shuffleQuestions} onChange={(v) => patch({ shuffleQuestions: v })} />
          <Toggle label="Negative marking" checked={template.negativeMarking} onChange={(v) => patch({ negativeMarking: v })} />
          <Toggle label="Show results to candidate" checked={template.showResultsToCandidate} onChange={(v) => patch({ showResultsToCandidate: v })} />
          <Toggle label="Require consent" checked={template.requireConsent} onChange={(v) => patch({ requireConsent: v })} />
          <Toggle label="Require webcam" checked={template.requireWebcam} onChange={(v) => patch({ requireWebcam: v })} />
          <Toggle label="Lockdown (fullscreen + no copy)" checked={template.lockdown} onChange={(v) => patch({ lockdown: v })} />
        </div>
      </section>

      {/* Sections */}
      <section className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--dash-text-strong)]">Sections</h3>
          <button type="button" onClick={addSection} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-primary)]">
            <Plus className="h-4 w-4" /> Add section
          </button>
        </div>
        {template.sections.length === 0 ? (
          <p className="text-sm text-[var(--dash-text-muted)]">No sections — questions appear as one list. Add sections for per-section timers or question pools.</p>
        ) : (
          <div className="space-y-3">
            {template.sections.map((s) => (
              <div key={s.clientKey} className="rounded-lg border border-[var(--dash-border-subtle)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input className="flex-1 rounded border border-[var(--dash-border)] px-2 py-1 text-sm font-medium" value={s.title} onChange={(e) => updateSection(s.clientKey, { title: e.target.value })} />
                  <NumberField label="Timer (min)" value={s.timeLimitMinutes} onChange={(v) => updateSection(s.clientKey, { timeLimitMinutes: v })} allowEmpty inline />
                  <NumberField label="Pick N" value={s.pickCount} onChange={(v) => updateSection(s.clientKey, { pickCount: v })} allowEmpty inline />
                  <Toggle label="Shuffle" checked={s.shuffleQuestions} onChange={(v) => updateSection(s.clientKey, { shuffleQuestions: v })} />
                  <button type="button" onClick={() => removeSection(s.clientKey)} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Questions */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[var(--dash-text-strong)]">
            Questions <span className="font-normal text-[var(--dash-text-muted)]">· {template.questions.length} · {totalPoints} pts</span>
          </h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowBank((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm font-medium">
              <Library className="h-4 w-4" /> Question bank
            </button>
            <button type="button" onClick={() => addQuestion(null)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Add question
            </button>
          </div>
        </div>

        {showBank ? (
          <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">Reuse from question bank</p>
            {bankItems.length === 0 ? (
              <p className="text-sm text-[var(--dash-text-muted)]">No saved questions yet.</p>
            ) : (
              <ul className="space-y-1">
                {bankItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--dash-surface)] px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{item.prompt}</span>
                    <button type="button" onClick={() => addFromBank(item)} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Add</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={template.questions.map((q) => q.clientKey)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {template.questions.map((q, i) => (
                <SortableQuestion
                  key={q.clientKey}
                  question={q}
                  index={i}
                  sections={template.sections}
                  onChange={(p) => updateQuestion(q.clientKey, p)}
                  onRemove={() => removeQuestion(q.clientKey)}
                  onDuplicate={() => duplicateQuestion(q.clientKey)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {template.questions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--dash-border)] px-4 py-8 text-center text-sm text-[var(--dash-text-muted)]">
            No questions yet. Add one or import from your question bank.
          </p>
        ) : null}
      </section>

      {/* Actions */}
      <div className="sticky bottom-0 flex items-center justify-between gap-2 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3 shadow-sm">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--dash-text-muted)]">Cancel</button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowPreview(true)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm font-medium">
            <Eye className="h-4 w-4" /> Preview
          </button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : template.id ? 'Save changes' : 'Create template'}
          </button>
        </div>
      </div>

      {showPreview ? <PreviewModal template={template} onClose={() => setShowPreview(false)} /> : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  allowEmpty,
  inline,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowEmpty?: boolean;
  inline?: boolean;
}) {
  return (
    <label className={inline ? 'flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]' : 'text-sm'}>
      <span className={inline ? '' : 'mb-1 block font-medium text-[var(--dash-text-strong)]'}>{label}</span>
      <input
        type="number"
        className={inline ? 'w-20 rounded border border-[var(--dash-border)] px-2 py-1' : 'w-full rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm'}
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '' && allowEmpty) onChange(null);
          else onChange(Number(raw));
        }}
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--dash-text-body)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function PreviewModal({ template, onClose }: { template: BuilderTemplate; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-neutral-900">{template.name || 'Untitled assessment'}</h2>
        {template.description ? <p className="mt-1 text-sm text-neutral-600">{template.description}</p> : null}
        <p className="mt-2 text-xs text-neutral-500">{template.timeLimitMinutes} minutes · {template.questions.length} questions</p>
        <div className="mt-5 space-y-4">
          {template.questions.map((q, i) => (
            <div key={q.clientKey} className="rounded-xl border border-neutral-200 p-4">
              <p className="text-sm font-medium text-neutral-900">{i + 1}. {q.prompt || <span className="italic text-neutral-400">Untitled question</span>}</p>
              {q.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.mediaUrl} alt="" className="mt-2 max-h-40 rounded-md" />
              ) : null}
              <PreviewAnswer question={q} />
            </div>
          ))}
        </div>
        <button type="button" onClick={onClose} className="mt-5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">Close preview</button>
      </div>
    </div>
  );
}

function PreviewAnswer({ question }: { question: BuilderQuestion }) {
  if (question.type === 'mcq' || question.type === 'multi_select' || question.type === 'ranking') {
    return (
      <ul className="mt-3 space-y-1.5 text-sm text-neutral-700">
        {question.options.map((o, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="inline-block h-3.5 w-3.5 rounded-full border border-neutral-300" />
            {o || <span className="italic text-neutral-400">Empty option</span>}
          </li>
        ))}
      </ul>
    );
  }
  if (question.type === 'likert' || question.type === 'rating') {
    const scale = question.scoring?.scale ?? 5;
    return (
      <div className="mt-3 flex gap-2">
        {Array.from({ length: scale }, (_, i) => (
          <span key={i} className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-xs">{i + 1}</span>
        ))}
      </div>
    );
  }
  return <div className="mt-3 h-10 rounded-lg border border-dashed border-neutral-300" />;
}

function normalizeToOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  return ['', ''];
}
