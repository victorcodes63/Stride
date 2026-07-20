'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

/** Avoids the SSR "useLayoutEffect does nothing on the server" warning. */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type StrideSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type StrideSelectSurface = 'dashboard' | 'ess' | 'public';

type StrideSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: StrideSelectOption[];
  /** Shown when no option matches the current value. */
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  /** Wrapper class — use for grid spans / width (e.g. "lg:col-span-2"). */
  className?: string;
  /** Extra classes on the trigger button. */
  triggerClassName?: string;
  ariaLabel?: string;
  /** Trigger height (dashboard surface only). */
  size?: 'sm' | 'md';
  /** Theme surface — controls tokens so the control matches its context. */
  surface?: StrideSelectSurface;
};

function join(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const TRIGGER_SIZE: Record<NonNullable<StrideSelectProps['size']>, string> = {
  sm: 'h-9',
  md: 'h-10',
};

type SurfaceStyles = {
  trigger: (size: NonNullable<StrideSelectProps['size']>) => string;
  menu: string;
  option: string;
  optionActive: string;
  optionSelected: string;
  placeholder: string;
  chevron: string;
};

const SURFACE_STYLES: Record<StrideSelectSurface, SurfaceStyles> = {
  dashboard: {
    trigger: (size) =>
      join(
        'dash-select-trigger rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary-500/30',
        TRIGGER_SIZE[size],
      ),
    menu: 'dash-popover',
    option: 'text-[var(--dash-text-strong)]',
    optionActive: 'bg-[var(--dash-hover)]',
    optionSelected: 'font-medium text-[var(--brand-primary)]',
    placeholder: 'text-[var(--dash-text-faint)]',
    chevron: 'text-[var(--dash-text-faint)]',
  },
  ess: {
    trigger: () => 'ess-field text-sm',
    menu:
      'border border-[var(--ess-border)] bg-[var(--ess-surface-raised,var(--ess-surface))] text-[var(--ess-text)] shadow-2xl',
    option: 'text-[var(--ess-text)]',
    optionActive: 'bg-[color-mix(in_srgb,var(--ess-primary)_14%,transparent)]',
    optionSelected: 'font-semibold text-[var(--ess-primary)]',
    placeholder: 'text-[var(--ess-muted)]',
    chevron: 'text-[var(--ess-muted)]',
  },
  public: {
    // Self-contained tokens with literal fallbacks so the portaled menu (rendered
    // on document.body, outside the .public-app scope) still themes correctly.
    trigger: () =>
      'h-10 rounded-md border border-[var(--pub-border,#e6ded4)] bg-[var(--pub-surface,#fbf8f4)] px-3 text-sm text-[var(--pub-ink,#1a1714)] focus-visible:ring-2 focus-visible:ring-primary-500/30',
    menu:
      'border border-[var(--pub-border,#e6ded4)] bg-[var(--pub-surface-elevated,#fbf8f4)] text-[var(--pub-ink,#1a1714)] shadow-2xl',
    option: 'text-[var(--pub-ink,#1a1714)]',
    optionActive: 'bg-[var(--pub-surface-muted,#f4efe8)]',
    optionSelected: 'font-medium text-[var(--pub-primary,#ff5436)]',
    placeholder: 'text-[var(--pub-ink-subtle,#8a8076)]',
    chevron: 'text-[var(--pub-ink-subtle,#8a8076)]',
  },
};

/**
 * Theme-aware, fully custom dropdown to replace native `<select>`.
 * - Renders its menu in a portal so it never clips inside overflow-hidden cards.
 * - Styling is driven by the shared dashboard tokens (dash-select-trigger /
 *   dash-popover), so it adapts to light, dark, and tenant brand schemes.
 * - Keyboard accessible listbox: arrows, Home/End, Enter/Space, Esc, typeahead.
 */
export function StrideSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  id,
  className,
  triggerClassName,
  ariaLabel,
  size = 'md',
  surface = 'dashboard',
}: StrideSelectProps) {
  const styles = SURFACE_STYLES[surface];
  const reactId = useId();
  const listboxId = `${id ?? reactId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef<{ query: string; at: number }>({ query: '', at: 0 });

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ position: 'fixed', top: 0, left: 0 });

  const selectedIndex = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value],
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => setMounted(true), []);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const gap = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const availableV = (openUp ? spaceAbove : spaceBelow) - gap - margin;
    const maxHeight = Math.max(160, Math.min(360, availableV));

    // The menu sizes to its content (capped via CSS max-width). Measure the
    // rendered width so we can flip/shift it to stay within the viewport
    // instead of forcing the narrow trigger width onto long option labels.
    const menuWidth = menuRef.current?.offsetWidth ?? rect.width;
    let left = rect.left;
    if (left + menuWidth > vw - margin) {
      left = Math.max(margin, vw - margin - menuWidth);
    }

    setMenuStyle({
      position: 'fixed',
      left: Math.round(left),
      minWidth: Math.round(rect.width),
      maxHeight,
      ...(openUp
        ? { bottom: Math.round(vh - rect.top + gap) }
        : { top: Math.round(rect.bottom + gap) }),
    });
    setReady(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const handle = () => reposition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const openMenu = useCallback(
    (initialIndex?: number) => {
      if (disabled) return;
      setActiveIndex(initialIndex ?? (selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options)));
      setOpen(true);
    },
    [disabled, options, selectedIndex],
  );

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      onChange(option.value);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange, options],
  );

  const moveActive = useCallback(
    (direction: 1 | -1) => {
      setActiveIndex((current) => {
        const count = options.length;
        if (count === 0) return -1;
        let next = current;
        for (let i = 0; i < count; i += 1) {
          next = (next + direction + count) % count;
          if (!options[next]?.disabled) return next;
        }
        return current;
      });
    },
    [options],
  );

  const typeahead = useCallback(
    (char: string) => {
      const now = Date.now();
      const state = typeaheadRef.current;
      state.query = now - state.at > 700 ? char : state.query + char;
      state.at = now;
      const query = state.query.toLowerCase();
      const match = options.findIndex(
        (o) => !o.disabled && o.label.toLowerCase().startsWith(query),
      );
      if (match >= 0) {
        if (open) setActiveIndex(match);
        else onChange(options[match]!.value);
      }
    },
    [onChange, open, options],
  );

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        event.preventDefault();
        openMenu();
        break;
      case 'Home':
        if (!open) {
          event.preventDefault();
          openMenu(firstEnabledIndex(options));
        }
        break;
      default:
        if (event.key.length === 1) typeahead(event.key);
    }
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(firstEnabledIndex(options));
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(lastEnabledIndex(options));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (activeIndex >= 0) commit(activeIndex);
        break;
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        if (event.key.length === 1) {
          event.preventDefault();
          typeahead(event.key);
        }
    }
  };

  useIsomorphicLayoutEffect(() => {
    if (open) menuRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  return (
    <div className={join('relative min-w-0', className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        className={join(
          'flex w-full items-center gap-2 text-left transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
          styles.trigger(size),
          triggerClassName,
        )}
      >
        <span className={join('min-w-0 flex-1 truncate', !selectedOption && styles.placeholder)}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={join('h-4 w-4 flex-shrink-0 transition-transform', styles.chevron, open && 'rotate-180')}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      {open && mounted
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              aria-label={ariaLabel}
              aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
              onKeyDown={onMenuKeyDown}
              style={{ ...menuStyle, zIndex: 60, visibility: ready ? 'visible' : 'hidden' }}
              className={join(
                'max-w-[min(28rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border py-1 focus:outline-none',
                styles.menu,
              )}
            >
              {options.length === 0 ? (
                <p className={join('px-3 py-2 text-sm', styles.placeholder)}>No options</p>
              ) : (
                options.map((option, index) => {
                  const isSelected = option.value === value;
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={`${option.value}-${index}`}
                      type="button"
                      role="option"
                      id={`${listboxId}-opt-${index}`}
                      data-index={index}
                      aria-selected={isSelected}
                      disabled={option.disabled}
                      onClick={() => commit(index)}
                      onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                      className={join(
                        'flex w-full items-start gap-2 px-3 py-2 text-left text-sm leading-snug transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        isActive ? styles.optionActive : '',
                        isSelected ? styles.optionSelected : styles.option,
                      )}
                    >
                      <span className="flex-1 break-words">{option.label}</span>
                      {isSelected ? <Check className={join('mt-0.5 h-4 w-4 flex-shrink-0', styles.optionSelected)} strokeWidth={2} aria-hidden /> : null}
                    </button>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function firstEnabledIndex(options: StrideSelectOption[]): number {
  const index = options.findIndex((o) => !o.disabled);
  return index;
}

function lastEnabledIndex(options: StrideSelectOption[]): number {
  for (let i = options.length - 1; i >= 0; i -= 1) {
    if (!options[i]?.disabled) return i;
  }
  return -1;
}
