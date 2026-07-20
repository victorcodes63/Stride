'use client';

import { useMemo } from 'react';
import { StrideSelect, type StrideSelectSurface } from '@/components/ui/stride-select';

export type FormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'select'
  | 'textarea'
  | 'checkbox';

export type FormFieldDef = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
  section?: string;
};

export type FormValues = Record<string, string | number | boolean | null>;

/** Runtime-safe parse of a template's `fields` JSON into typed field defs. */
export function parseFormFields(raw: unknown): FormFieldDef[] {
  if (!Array.isArray(raw)) return [];
  const out: FormFieldDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;
    if (typeof f.key !== 'string' || typeof f.label !== 'string') continue;
    const type = (typeof f.type === 'string' ? f.type : 'text') as FormFieldType;
    out.push({
      key: f.key,
      label: f.label,
      type,
      required: Boolean(f.required),
      options: Array.isArray(f.options) ? f.options.filter((o): o is string => typeof o === 'string') : undefined,
      placeholder: typeof f.placeholder === 'string' ? f.placeholder : undefined,
      helpText: typeof f.helpText === 'string' ? f.helpText : undefined,
      section: typeof f.section === 'string' ? f.section : undefined,
    });
  }
  return out;
}

/** Returns a map of fieldKey -> error message for any required field left blank. */
export function getFormValidationErrors(
  fields: FormFieldDef[],
  values: FormValues,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!field.required) continue;
    const value = values[field.key];
    if (field.type === 'checkbox') {
      if (value !== true) errors[field.key] = `${field.label} is required.`;
      continue;
    }
    if (value === null || value === undefined || String(value).trim() === '') {
      errors[field.key] = `${field.label} is required.`;
    }
  }
  return errors;
}

type DynamicFormProps = {
  fields: FormFieldDef[];
  values: FormValues;
  onChange: (key: string, value: string | number | boolean | null) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  surface?: StrideSelectSurface;
};

const inputBase =
  'w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-60';

const surfaceInputClass: Record<StrideSelectSurface, string> = {
  dashboard: 'border-[var(--dash-border)] bg-[var(--dash-surface)] text-[var(--dash-text-strong)] placeholder:text-[var(--dash-text-faint)]',
  ess: 'border-[var(--ess-border)] bg-[var(--ess-surface)] text-[var(--ess-text)] placeholder:text-[var(--ess-muted)]',
  public: 'border-neutral-300 bg-white text-neutral-900',
};

const surfaceLabelClass: Record<StrideSelectSurface, string> = {
  dashboard: 'text-[var(--dash-text-strong)]',
  ess: 'text-[var(--ess-text)]',
  public: 'text-neutral-900',
};

const surfaceHelpClass: Record<StrideSelectSurface, string> = {
  dashboard: 'text-[var(--dash-text-muted)]',
  ess: 'text-[var(--ess-muted)]',
  public: 'text-neutral-500',
};

/**
 * Renders a set of form field definitions as controlled inputs.
 * Fields are grouped by their optional `section` for readability.
 */
export function DynamicForm({
  fields,
  values,
  onChange,
  errors,
  disabled,
  surface = 'ess',
}: DynamicFormProps) {
  const sections = useMemo(() => {
    const map = new Map<string, FormFieldDef[]>();
    for (const field of fields) {
      const key = field.section?.trim() || '';
      const list = map.get(key) ?? [];
      list.push(field);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [fields]);

  const inputClass = `${inputBase} ${surfaceInputClass[surface]}`;

  return (
    <div className="space-y-6">
      {sections.map(([section, sectionFields]) => (
        <div key={section || '__default'} className="space-y-4">
          {section ? (
            <h3 className={`text-xs font-semibold uppercase tracking-wide ${surfaceHelpClass[surface]}`}>
              {section}
            </h3>
          ) : null}
          {sectionFields.map((field) => {
            const value = values[field.key];
            const error = errors?.[field.key];
            const describedBy = error
              ? `${field.key}-error`
              : field.helpText
                ? `${field.key}-help`
                : undefined;

            if (field.type === 'checkbox') {
              return (
                <label key={field.key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-neutral-300"
                    checked={value === true}
                    disabled={disabled}
                    aria-describedby={describedBy}
                    onChange={(e) => onChange(field.key, e.target.checked)}
                  />
                  <span>
                    <span className={`font-medium ${surfaceLabelClass[surface]}`}>
                      {field.label}
                      {field.required ? <span className="text-red-500"> *</span> : null}
                    </span>
                    {field.helpText ? (
                      <span id={`${field.key}-help`} className={`mt-0.5 block text-xs ${surfaceHelpClass[surface]}`}>
                        {field.helpText}
                      </span>
                    ) : null}
                    {error ? (
                      <span id={`${field.key}-error`} className="mt-0.5 block text-xs text-red-500">
                        {error}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            }

            return (
              <div key={field.key} className="space-y-1">
                <label htmlFor={field.key} className={`block text-sm font-medium ${surfaceLabelClass[surface]}`}>
                  {field.label}
                  {field.required ? <span className="text-red-500"> *</span> : null}
                </label>

                {field.type === 'select' ? (
                  <StrideSelect
                    id={field.key}
                    surface={surface}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(v) => onChange(field.key, v)}
                    disabled={disabled}
                    ariaLabel={field.label}
                    placeholder={field.placeholder || 'Select…'}
                    options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
                  />
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={field.key}
                    className={`${inputClass} min-h-[96px]`}
                    value={typeof value === 'string' ? value : ''}
                    placeholder={field.placeholder}
                    disabled={disabled}
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) => onChange(field.key, e.target.value)}
                  />
                ) : (
                  <input
                    id={field.key}
                    type={
                      field.type === 'email'
                        ? 'email'
                        : field.type === 'phone'
                          ? 'tel'
                          : field.type === 'number'
                            ? 'number'
                            : field.type === 'date'
                              ? 'date'
                              : 'text'
                    }
                    className={inputClass}
                    value={value === null || value === undefined ? '' : String(value)}
                    placeholder={field.placeholder}
                    disabled={disabled}
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : undefined}
                    onChange={(e) =>
                      onChange(
                        field.key,
                        field.type === 'number'
                          ? e.target.value === ''
                            ? null
                            : Number(e.target.value)
                          : e.target.value,
                      )
                    }
                  />
                )}

                {field.helpText && !error ? (
                  <p id={`${field.key}-help`} className={`text-xs ${surfaceHelpClass[surface]}`}>
                    {field.helpText}
                  </p>
                ) : null}
                {error ? (
                  <p id={`${field.key}-error`} className="text-xs text-red-500">
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
