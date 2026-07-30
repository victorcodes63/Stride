'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react';

export type ColumnOption<T extends string = string> = {
  id: T;
  label: string;
  /** When true, column stays visible and cannot be toggled off in the picker. */
  locked?: boolean;
};

type ColumnPickerMenuProps<T extends string> = {
  columns: Array<ColumnOption<T>>;
  visible: Set<T>;
  onToggle: (id: T) => void;
  onReset: () => void;
  /** Visual density to match surrounding toolbar controls. */
  size?: 'sm' | 'md';
};

/**
 * App-UI column visibility menu (same pattern as Payroll). Not a native select.
 */
export function ColumnPickerMenu<T extends string>({
  columns,
  visible,
  onToggle,
  onReset,
  size = 'md',
}: ColumnPickerMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleable = columns.filter((c) => !c.locked);
  const visibleCount = columns.filter((c) => visible.has(c.id) || c.locked).length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] font-medium text-[var(--dash-text-body)] hover:bg-[var(--dash-hover)] ${
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        }`}
      >
        <SlidersHorizontal className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        Columns
        <span className="rounded bg-[var(--dash-surface-muted)] px-1.5 text-[11px] tabular-nums text-[var(--dash-text-muted)]">
          {visibleCount}
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-2 shadow-lg"
        >
          <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--dash-text-muted)]">
            Show columns
          </p>
          <div className="max-h-72 overflow-auto">
            {toggleable.map((col) => {
              const checked = visible.has(col.id);
              return (
                <button
                  key={col.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  onClick={() => onToggle(col.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-[var(--dash-text-body)] hover:bg-[var(--dash-hover)]"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked
                        ? 'border-[var(--stride-coral)] bg-[var(--stride-coral)] text-white'
                        : 'border-[var(--dash-border)] bg-[var(--dash-surface-solid)]'
                    }`}
                  >
                    {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  {col.label}
                </button>
              );
            })}
          </div>
          <div className="mt-1 border-t border-[var(--dash-border)] pt-1">
            <button
              type="button"
              onClick={onReset}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)] hover:text-[var(--dash-text-body)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to default
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type UseColumnVisibilityOptions<T extends string> = {
  storageKey: string;
  columnOrder: readonly T[];
  defaults: readonly T[];
  /** Columns that must always remain visible (not persisted as toggles). */
  locked?: readonly T[];
};

/**
 * Persistable column visibility with hydration-safe localStorage sync.
 */
export function useColumnVisibility<T extends string>({
  storageKey,
  columnOrder,
  defaults,
  locked = [],
}: UseColumnVisibilityOptions<T>) {
  const lockedKey = locked.join('|');
  const lockedIds = useMemo(() => locked as readonly T[], [lockedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const orderKey = columnOrder.join('|');
  const order = useMemo(() => columnOrder as readonly T[], [orderKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const defaultKey = defaults.join('|');
  const defaultIds = useMemo(() => defaults as readonly T[], [defaultKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [visible, setVisible] = useState<Set<T>>(() => new Set([...defaults, ...locked]));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((id): id is T => order.includes(id as T));
          setVisible(new Set([...valid, ...lockedIds]));
        }
      }
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, [storageKey, order, lockedIds]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const persistable = [...visible].filter((id) => !lockedIds.includes(id));
      localStorage.setItem(storageKey, JSON.stringify(persistable));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [visible, hydrated, storageKey, lockedIds]);

  const toggle = useCallback(
    (id: T) => {
      if (lockedIds.includes(id)) return;
      setVisible((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          const remaining = [...next].filter((x) => x !== id && !lockedIds.includes(x));
          if (remaining.length === 0 && lockedIds.length === 0) return prev;
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [lockedIds],
  );

  const reset = useCallback(() => {
    setVisible(new Set([...defaultIds, ...lockedIds]));
  }, [defaultIds, lockedIds]);

  const isVisible = useCallback(
    (id: T) => lockedIds.includes(id) || visible.has(id),
    [lockedIds, visible],
  );

  const orderedVisible = order.filter((id) => isVisible(id));

  return {
    visible,
    hydrated,
    toggle,
    reset,
    isVisible,
    orderedVisible,
  };
}

/** Compact helper: only render children when the column is visible. */
export function VisibleColumn({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  if (!show) return null;
  return <>{children}</>;
}
