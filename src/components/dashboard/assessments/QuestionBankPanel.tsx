'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';
import { QUESTION_TYPE_LABELS, type BuilderQuestion, type QuestionType } from './builder-types';

type BankItem = {
  id: string;
  type: QuestionType;
  prompt: string;
  options: unknown;
  correctAnswer: unknown;
  scoring: unknown;
  defaultPoints: number;
  difficulty: BuilderQuestion['difficulty'];
  category?: string | null;
  tags?: string[];
};

const TYPE_OPTIONS = (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }));

export function QuestionBankPanel({ items, onChanged }: { items: BankItem[]; onChanged: () => Promise<void> | void }) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<QuestionType>('mcq');
  const [prompt, setPrompt] = useState('');
  const [options, setOptions] = useState('');
  const [correct, setCorrect] = useState('');
  const [category, setCategory] = useState('');
  const [defaultPoints, setDefaultPoints] = useState(1);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!prompt.trim()) return;
    setSaving(true);
    const optionList = options.split('\n').map((s) => s.trim()).filter(Boolean);
    await fetch('/api/assessments/question-bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        prompt,
        options: optionList.length ? optionList : undefined,
        correctAnswer: correct ? { value: correct } : undefined,
        category: category || undefined,
        defaultPoints,
      }),
    });
    setSaving(false);
    setAdding(false);
    setPrompt('');
    setOptions('');
    setCorrect('');
    setCategory('');
    await onChanged();
  }

  async function remove(id: string) {
    if (!confirm('Delete this question from the bank?')) return;
    await fetch(`/api/assessments/question-bank/${id}`, { method: 'DELETE' });
    await onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--dash-text-strong)]">Question bank</h3>
          <p className="text-xs text-[var(--dash-text-muted)]">Author questions once and reuse them across templates.</p>
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> Add question
        </button>
      </div>

      {adding ? (
        <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Type</span>
              <StrideSelect value={type} onChange={(v) => setType(v as QuestionType)} options={TYPE_OPTIONS} ariaLabel="Type" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Category</span>
              <input className="w-full rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Accounting" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Prompt</span>
              <textarea className="w-full rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Options (one per line)</span>
              <textarea className="w-full rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm" rows={3} value={options} onChange={(e) => setOptions(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-[var(--dash-text-strong)]">Correct answer</span>
              <input className="w-full rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm" value={correct} onChange={(e) => setCorrect(e.target.value)} />
              <span className="mb-1 mt-2 block font-medium text-[var(--dash-text-strong)]">Default points</span>
              <input type="number" className="w-24 rounded-lg border border-[var(--dash-border)] px-3 py-2 text-sm" value={defaultPoints} onChange={(e) => setDefaultPoints(Number(e.target.value))} />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--dash-border)] px-4 py-8 text-center text-sm text-[var(--dash-text-muted)]">No saved questions yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--dash-text-strong)]">{item.prompt}</p>
                <p className="text-xs text-[var(--dash-text-muted)]">{QUESTION_TYPE_LABELS[item.type]}{item.category ? ` · ${item.category}` : ''} · {item.defaultPoints} pts</p>
              </div>
              <button type="button" onClick={() => remove(item.id)} className="rounded-md p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
