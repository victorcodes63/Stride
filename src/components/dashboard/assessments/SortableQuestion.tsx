'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Copy, ImagePlus } from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';
import { RichPromptEditor } from './RichPromptEditor';
import {
  AUTO_KEYED,
  DIMENSIONAL,
  QUESTION_TYPE_LABELS,
  type BuilderQuestion,
  type BuilderSection,
  type QuestionType,
} from './builder-types';

const TYPE_OPTIONS = (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => ({
  value: t,
  label: QUESTION_TYPE_LABELS[t],
}));

export function SortableQuestion({
  question,
  index,
  sections,
  onChange,
  onRemove,
  onDuplicate,
}: {
  question: BuilderQuestion;
  index: number;
  sections: BuilderSection[];
  onChange: (patch: Partial<BuilderQuestion>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.clientKey,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  async function uploadMedia(file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/assessments/media', { method: 'POST', body: form });
    const data = await res.json();
    if (res.ok && data.url) onChange({ mediaUrl: data.url });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-4"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 cursor-grab text-[var(--dash-text-faint)] hover:text-[var(--dash-text-strong)]"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--dash-text-muted)]">Q{index + 1}</span>
            <div className="w-52">
              <StrideSelect
                value={question.type}
                onChange={(value) => onChange({ type: value as QuestionType, correctAnswer: null })}
                options={TYPE_OPTIONS}
                ariaLabel="Question type"
                size="sm"
              />
            </div>
            {sections.length > 0 ? (
              <div className="w-44">
                <StrideSelect
                  value={question.sectionKey ?? ''}
                  onChange={(value) => onChange({ sectionKey: value || null })}
                  options={[{ value: '', label: 'No section' }, ...sections.map((s) => ({ value: s.clientKey, label: s.title }))]}
                  ariaLabel="Section"
                  size="sm"
                />
              </div>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              <label className="cursor-pointer rounded-md p-1.5 text-[var(--dash-text-faint)] hover:bg-[var(--dash-hover)]" title="Add image">
                <ImagePlus className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadMedia(e.target.files[0])}
                />
              </label>
              <button type="button" onClick={onDuplicate} className="rounded-md p-1.5 text-[var(--dash-text-faint)] hover:bg-[var(--dash-hover)]" title="Duplicate">
                <Copy className="h-4 w-4" />
              </button>
              <button type="button" onClick={onRemove} className="rounded-md p-1.5 text-red-500 hover:bg-red-50" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <RichPromptEditor value={question.prompt} onChange={(prompt) => onChange({ prompt })} />

          {question.mediaUrl ? (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={question.mediaUrl} alt="Question media" className="h-16 rounded-md border border-[var(--dash-border)]" />
              <button type="button" onClick={() => onChange({ mediaUrl: null })} className="text-xs text-red-500 hover:underline">
                Remove image
              </button>
            </div>
          ) : null}

          <AnswerEditor question={question} onChange={onChange} />

          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--dash-text-muted)]">
            {!DIMENSIONAL.includes(question.type) ? (
              <label className="flex items-center gap-1.5">
                Points
                <input
                  type="number"
                  min={0}
                  className="w-16 rounded border border-[var(--dash-border)] px-2 py-1"
                  value={question.maxPoints}
                  onChange={(e) => onChange({ maxPoints: Number(e.target.value) })}
                />
              </label>
            ) : null}
            <label className="flex items-center gap-1.5">
              Difficulty
              <select
                className="rounded border border-[var(--dash-border)] px-2 py-1"
                value={question.difficulty}
                onChange={(e) => onChange({ difficulty: e.target.value as BuilderQuestion['difficulty'] })}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={question.required} onChange={(e) => onChange({ required: e.target.checked })} />
              Required
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnswerEditor({ question, onChange }: { question: BuilderQuestion; onChange: (patch: Partial<BuilderQuestion>) => void }) {
  const { type } = question;

  if (type === 'mcq' || type === 'multi_select' || type === 'ranking') {
    const correct = normalizeCorrect(question.correctAnswer);
    return (
      <div className="space-y-2">
        {question.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            {type === 'mcq' ? (
              <input
                type="radio"
                name={`correct-${question.clientKey}`}
                checked={correct[0] === opt && opt !== ''}
                onChange={() => onChange({ correctAnswer: { value: opt } })}
                aria-label="Mark correct"
              />
            ) : type === 'multi_select' ? (
              <input
                type="checkbox"
                checked={correct.includes(opt) && opt !== ''}
                onChange={(e) => {
                  const next = e.target.checked ? [...correct, opt] : correct.filter((c) => c !== opt);
                  onChange({ correctAnswer: { value: next } });
                }}
                aria-label="Mark correct"
              />
            ) : (
              <span className="w-5 text-center text-xs text-[var(--dash-text-faint)]">{i + 1}</span>
            )}
            <input
              className="flex-1 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm"
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={(e) => {
                const options = [...question.options];
                options[i] = e.target.value;
                onChange({ options });
              }}
            />
            <button
              type="button"
              className="text-xs text-[var(--dash-text-faint)] hover:text-red-500"
              onClick={() => onChange({ options: question.options.filter((_, j) => j !== i) })}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
          onClick={() => onChange({ options: [...question.options, ''] })}
        >
          + Add option
        </button>
        {type === 'ranking' ? (
          <p className="text-xs text-[var(--dash-text-faint)]">Correct order = the order shown above.</p>
        ) : null}
      </div>
    );
  }

  if (type === 'numeric') {
    const correct = normalizeCorrect(question.correctAnswer);
    return (
      <input
        type="number"
        className="w-40 rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm"
        placeholder="Correct value"
        value={correct[0] ?? ''}
        onChange={(e) => onChange({ correctAnswer: { value: e.target.value } })}
      />
    );
  }

  if (type === 'short_text') {
    const correct = normalizeCorrect(question.correctAnswer);
    return (
      <input
        className="w-full rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm"
        placeholder="Accepted answers (comma separated)"
        value={correct.join(', ')}
        onChange={(e) => onChange({ correctAnswer: { value: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })}
      />
    );
  }

  if (DIMENSIONAL.includes(type)) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
          Dimension
          <input
            className="w-40 rounded border border-[var(--dash-border)] px-2 py-1 text-sm"
            placeholder="e.g. Conscientiousness"
            value={question.scoring?.dimension ?? ''}
            onChange={(e) => onChange({ scoring: { ...question.scoring, dimension: e.target.value } })}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
          Scale
          <input
            type="number"
            min={2}
            max={10}
            className="w-16 rounded border border-[var(--dash-border)] px-2 py-1 text-sm"
            value={question.scoring?.scale ?? 5}
            onChange={(e) => onChange({ scoring: { ...question.scoring, scale: Number(e.target.value) } })}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)]">
          <input
            type="checkbox"
            checked={question.scoring?.reverse ?? false}
            onChange={(e) => onChange({ scoring: { ...question.scoring, reverse: e.target.checked } })}
          />
          Reverse-scored
        </label>
      </div>
    );
  }

  return (
    <p className="text-xs italic text-[var(--dash-text-faint)]">
      {AUTO_KEYED.includes(type) ? '' : 'Open-ended — graded manually by your team.'}
    </p>
  );
}

function normalizeCorrect(value: unknown): string[] {
  const inner = value && typeof value === 'object' && 'value' in value ? (value as { value: unknown }).value : value;
  if (Array.isArray(inner)) return inner.map((v) => String(v));
  if (inner === null || inner === undefined || inner === '') return [];
  return [String(inner)];
}
