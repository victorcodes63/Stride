'use client';

export type AppSelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type AppSelectProps = {
  options: AppSelectOption[];
  value: string | string[] | null;
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  label?: string;
  'aria-label'?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  searchable?: boolean;
  multiple?: boolean;
  clearable?: boolean;
  emptyMessage?: string;
  className?: string;
  density?: 'default' | 'compact';
};

/** Lightweight native select matching the AppSelect call sites used by calendar. */
export default function AppSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  'aria-label': ariaLabel,
  id,
  name,
  disabled = false,
  className = '',
  density = 'default',
}: AppSelectProps) {
  const compact = density === 'compact';
  const selected = typeof value === 'string' ? value : Array.isArray(value) ? value[0] ?? '' : '';

  return (
    <label className={`block text-sm font-medium text-neutral-700 ${className}`.trim()}>
      {label ? <span className="mb-1 block">{label}</span> : null}
      <select
        id={id}
        name={name}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500/30 ${
          compact ? 'h-9 py-1.5' : 'h-10 py-2'
        }`}
      >
        {!selected ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
