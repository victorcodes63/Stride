'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { StrideSelect } from '@/components/ui/stride-select';
import { DynamicForm, type FormFieldDef, type FormFieldType, parseFormFields } from '@/components/onboarding/DynamicForm';

const FIELD_TYPE_OPTIONS: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'textarea', label: 'Long text' },
  { value: 'checkbox', label: 'Checkbox' },
];

type TemplateDetail = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  fields: unknown;
};

function blankField(index: number): FormFieldDef {
  return { key: `field_${index}`, label: '', type: 'text', required: false };
}

export default function FormBuilderPage() {
  const params = useParams();
  const id = params?.id as string;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, string | number | boolean | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/forms/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load form');
      setName(data.name ?? '');
      setDescription(data.description ?? '');
      setIsActive(Boolean(data.isActive));
      setFields(parseFormFields(data.fields));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  function updateField(index: number, patch: Partial<FormFieldDef>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function move(index: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function addField() {
    setFields((prev) => [...prev, blankField(prev.length + 1)]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): string | null {
    const keys = new Set<string>();
    for (const field of fields) {
      const key = field.key.trim();
      if (!key) return 'Every field needs a key.';
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
        return `Field key "${key}" must start with a letter (letters, numbers, underscores only).`;
      }
      if (!field.label.trim()) return `Field "${key}" needs a label.`;
      if (keys.has(key)) return `Duplicate field key "${key}".`;
      keys.add(key);
    }
    return null;
  }

  async function save() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/onboarding/forms/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          isActive,
          fields: fields.map((f) => ({
            key: f.key.trim(),
            label: f.label.trim(),
            type: f.type,
            required: f.required,
            options: f.type === 'select' ? f.options ?? [] : undefined,
            placeholder: f.placeholder || undefined,
            helpText: f.helpText || undefined,
            section: f.section || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setNotice('Form saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardPage>
      <Link
        href="/dashboard/onboarding/forms"
        className="mb-3 inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Forms
      </Link>
      <DashboardPageHeader title="Form builder" description="Add, reorder, and configure the fields employees will fill in." />

      {error ? (
        <div className="my-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {notice ? (
        <div className="my-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="dashboard-surface flex items-center gap-2 p-6 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="dashboard-surface space-y-3 p-4 shadow-sm">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">Form name</span>
                <input
                  className={`${dashboardFilterSelectClass} w-full`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">Description</span>
                <input
                  className={`${dashboardFilterSelectClass} w-full`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="font-medium text-neutral-800">Active (available to attach to steps)</span>
              </label>
            </div>

            <div className="dashboard-surface p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900">Fields ({fields.length})</h2>
                <button type="button" className="btn-secondary inline-flex items-center gap-1" onClick={addField}>
                  <Plus className="h-4 w-4" />
                  Add field
                </button>
              </div>

              <div className="mt-3 space-y-3">
                {fields.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">
                    No fields yet. Add your first field.
                  </p>
                ) : null}
                {fields.map((field, index) => (
                  <div key={index} className="rounded-lg border border-neutral-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-400">#{index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
                          disabled={index === 0}
                          aria-label="Move up"
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
                          disabled={index === fields.length - 1}
                          aria-label="Move down"
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove field"
                          onClick={() => removeField(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-neutral-600">Label</span>
                        <input
                          className={`${dashboardFilterSelectClass} w-full`}
                          value={field.label}
                          onChange={(e) => updateField(index, { label: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-neutral-600">Key (stored)</span>
                        <input
                          className={`${dashboardFilterSelectClass} w-full`}
                          value={field.key}
                          onChange={(e) => updateField(index, { key: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-neutral-600">Type</span>
                        <StrideSelect
                          value={field.type}
                          onChange={(v) => updateField(index, { type: v as FormFieldType })}
                          options={FIELD_TYPE_OPTIONS}
                          ariaLabel="Field type"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-neutral-600">Section (optional)</span>
                        <input
                          className={`${dashboardFilterSelectClass} w-full`}
                          value={field.section ?? ''}
                          onChange={(e) => updateField(index, { section: e.target.value })}
                        />
                      </label>
                      {field.type === 'select' ? (
                        <label className="block sm:col-span-2">
                          <span className="mb-1 block text-xs font-medium text-neutral-600">
                            Options (comma-separated)
                          </span>
                          <input
                            className={`${dashboardFilterSelectClass} w-full`}
                            value={(field.options ?? []).join(', ')}
                            onChange={(e) =>
                              updateField(index, {
                                options: e.target.value
                                  .split(',')
                                  .map((o) => o.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </label>
                      ) : null}
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs font-medium text-neutral-600">Placeholder / help text</span>
                        <input
                          className={`${dashboardFilterSelectClass} w-full`}
                          value={field.helpText ?? ''}
                          onChange={(e) => updateField(index, { helpText: e.target.value })}
                        />
                      </label>
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300"
                        checked={field.required}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                      />
                      <span className="text-neutral-700">Required</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="btn-primary inline-flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save form
            </button>
          </div>

          <div className="lg:col-span-1">
            <div className="dashboard-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-900">Live preview</h2>
              <p className="mb-3 mt-0.5 text-xs text-neutral-500">How employees will see this form.</p>
              {fields.length ? (
                <DynamicForm
                  surface="dashboard"
                  fields={fields.filter((f) => f.label.trim() && f.key.trim())}
                  values={previewValues}
                  onChange={(key, value) => setPreviewValues((v) => ({ ...v, [key]: value }))}
                />
              ) : (
                <p className="text-sm text-neutral-400">Add fields to preview.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardPage>
  );
}
