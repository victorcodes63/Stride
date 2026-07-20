'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Download, Loader2 } from 'lucide-react';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export type ExportOption = {
  format: ExportFormat;
  label: string;
  /** Either a URL to open, or a handler that performs the export. */
  href?: string;
  onSelect?: () => void | Promise<void>;
};

const FORMAT_LABEL: Record<ExportFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel (.xlsx)',
  pdf: 'PDF',
};

export type ExportButtonProps = {
  options: ExportOption[];
  label?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Shared export affordance. Renders a single button when one format is given, or
 * a dropdown menu for multiple. URLs open in a new tab; handlers run inline.
 */
export function ExportButton({ options, label = 'Export', disabled, className }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const runOption = async (option: ExportOption) => {
    setOpen(false);
    if (option.href) {
      window.open(option.href, '_blank', 'noopener');
      return;
    }
    if (option.onSelect) {
      try {
        setBusy(option.format);
        await option.onSelect();
      } finally {
        setBusy(null);
      }
    }
  };

  if (options.length === 0) return null;

  if (options.length === 1) {
    const only = options[0];
    return (
      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => void runOption(only)}
        className={`btn-secondary inline-flex items-center gap-2 ${className ?? ''}`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {only.label ?? `${label} ${FORMAT_LABEL[only.format]}`}
      </button>
    );
  }

  return (
    <div className={`relative ${className ?? ''}`} ref={ref}>
      <button
        type="button"
        disabled={disabled || busy !== null}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="btn-secondary inline-flex items-center gap-2"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div
          role="menu"
          className="dash-modal-panel absolute right-0 z-30 mt-1.5 w-48 overflow-hidden rounded-lg border py-1 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.format}
              type="button"
              role="menuitem"
              onClick={() => void runOption(option)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[var(--dash-text)] hover:bg-[var(--dash-hover)]"
            >
              <span>{option.label ?? FORMAT_LABEL[option.format]}</span>
              {busy === option.format ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy === null && option.href ? <Check className="h-3.5 w-3.5 opacity-0" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
