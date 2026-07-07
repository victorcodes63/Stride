'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Briefcase, CornerDownLeft, FileText, Search, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SearchResponse, SearchResultItem } from '@/app/api/search/route';
import { useDashboardDomain } from '@/contexts/dashboard-domain';
import { useDashboardNavBuildOptions } from '@/hooks/use-dashboard-nav-build-options';
import {
  filterDomainNavItems,
  getDomainNavModuleItems,
  getDomainSearchPlaceholder,
  type DomainNavModuleItem,
} from '@/lib/dashboard-domain-nav';
import { useDashboardSession } from '@/contexts/dashboard-session';

type FlattenedEntry =
  | { kind: 'section'; label: string }
  | { kind: 'nav'; item: DomainNavModuleItem; index: number }
  | { kind: 'record'; item: SearchResultItem; index: number };

function flattenResults(
  navMatches: DomainNavModuleItem[],
  records: SearchResponse,
  includeRecords: boolean,
): FlattenedEntry[] {
  const out: FlattenedEntry[] = [];
  if (navMatches.length) {
    out.push({ kind: 'section', label: 'Pages' });
    navMatches.forEach((item, i) => out.push({ kind: 'nav', item, index: i }));
  }
  if (!includeRecords) return out;
  if (records.jobs.length) {
    out.push({ kind: 'section', label: 'Jobs' });
    records.jobs.forEach((item, i) => out.push({ kind: 'record', item, index: i }));
  }
  if (records.candidates.length) {
    out.push({ kind: 'section', label: 'Candidates' });
    records.candidates.forEach((item, i) => out.push({ kind: 'record', item, index: i }));
  }
  if (records.applications.length) {
    out.push({ kind: 'section', label: 'Applications' });
    records.applications.forEach((item, i) => out.push({ kind: 'record', item, index: i }));
  }
  return out;
}

function getSelectableIndexes(entries: FlattenedEntry[]): number[] {
  return entries
    .map((e, i) => (e.kind === 'section' ? -1 : i))
    .filter((i) => i >= 0);
}

const RECORD_ICONS: Record<SearchResultItem['type'], LucideIcon> = {
  job: Briefcase,
  candidate: User,
  application: FileText,
};

/** Bounds of the dashboard workspace column (right of sidebar, includes top bar + main). */
function measureWorkspaceBounds(): { top: number; left: number; width: number; height: number } | null {
  if (typeof window === 'undefined') return null;
  const main = document.getElementById('main-content');
  const shell = main?.parentElement;
  if (!shell) return null;
  const rect = shell.getBoundingClientRect();
  if (rect.width < 320) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export default function CommandPalette({
  open,
  onClose,
  initialQuery = '',
  sidebarOpen = true,
}: {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  /** Keeps palette aligned when the nav column toggles. */
  sidebarOpen?: boolean;
}) {
  const router = useRouter();
  const { activeDomain } = useDashboardDomain();
  const navOptions = useDashboardNavBuildOptions();
  const { modules } = useDashboardSession();
  const [query, setQuery] = useState(initialQuery);
  const [records, setRecords] = useState<SearchResponse>({
    jobs: [],
    candidates: [],
    applications: [],
  });
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [workspaceBounds, setWorkspaceBounds] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    const updateBounds = () => {
      const measured = measureWorkspaceBounds();
      if (measured) setWorkspaceBounds(measured);
    };

    updateBounds();
    const raf = window.requestAnimationFrame(updateBounds);

    window.addEventListener('resize', updateBounds);

    const main = document.getElementById('main-content');
    const shell = main?.parentElement ?? null;
    const observer =
      shell && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateBounds())
        : null;
    if (shell && observer) observer.observe(shell);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateBounds);
      observer?.disconnect();
    };
  }, [open, sidebarOpen]);

  const domainNavItems = useMemo(
    () => getDomainNavModuleItems(navOptions, activeDomain.id),
    [navOptions, activeDomain.id],
  );

  const placeholder = useMemo(
    () => getDomainSearchPlaceholder(activeDomain.id),
    [activeDomain.id],
  );

  const trimmedQuery = query.trim();
  const includeRecruitmentRecords =
    activeDomain.id === 'hr-payroll' && modules.ats !== false && trimmedQuery.length >= 2;

  const navMatches = useMemo(() => {
    if (!trimmedQuery) return domainNavItems.slice(0, 8);
    return filterDomainNavItems(domainNavItems, trimmedQuery);
  }, [domainNavItems, trimmedQuery]);

  const entries = useMemo(
    () => flattenResults(navMatches, records, includeRecruitmentRecords),
    [navMatches, records, includeRecruitmentRecords],
  );
  const selectableIndexes = useMemo(() => getSelectableIndexes(entries), [entries]);
  const flatSelected = selectableIndexes[selectedIndex] ?? 0;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    setSelectedIndex(0);
  }, [open]);

  useEffect(() => {
    const n = selectableIndexes.length;
    if (n > 0 && selectedIndex >= n) setSelectedIndex(n - 1);
  }, [selectableIndexes.length, selectedIndex]);

  useEffect(() => {
    if (!open || !includeRecruitmentRecords) {
      setRecords({ jobs: [], candidates: [], applications: [] });
      return;
    }
    const t = setTimeout(() => {
      setLoadingRecords(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`)
        .then((r) => r.json())
        .then((data: SearchResponse) => {
          setRecords(data);
          setSelectedIndex(0);
        })
        .finally(() => setLoadingRecords(false));
    }, 200);
    return () => clearTimeout(t);
  }, [trimmedQuery, open, includeRecruitmentRecords]);

  const handleSelectHref = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectableIndexes.length === 0) return;
        setSelectedIndex((i) => (i + 1) % selectableIndexes.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectableIndexes.length === 0) return;
        setSelectedIndex((i) => (i - 1 + selectableIndexes.length) % selectableIndexes.length);
        return;
      }
      if (e.key === 'Enter') {
        const idx = selectableIndexes[selectedIndex];
        if (idx === undefined) return;
        const entry = entries[idx];
        if (!entry || entry.kind === 'section') return;
        e.preventDefault();
        if (entry.kind === 'nav') {
          handleSelectHref(entry.item.href);
        } else {
          handleSelectHref(entry.item.href);
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, selectableIndexes, selectedIndex, entries, handleSelectHref, onClose]);

  useEffect(() => {
    const idx = selectableIndexes[selectedIndex];
    if (idx === undefined) return;
    listRef.current?.querySelector(`[data-index="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, selectableIndexes]);

  if (!open || !mounted) return null;

  const emptyMessage = trimmedQuery
    ? `No results for "${query.trim()}"`
    : 'Start typing to search pages in this module';

  const anchor = workspaceBounds ?? {
    top: 0,
    left: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  };

  return createPortal(
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-[200] dash-modal-backdrop backdrop-blur-sm"
        aria-label="Close search"
      />
      <div
        className="pointer-events-none fixed z-[201] flex items-center justify-center px-4 py-6 sm:px-6"
        style={{
          top: anchor.top,
          left: anchor.left,
          width: anchor.width,
          height: anchor.height,
        }}
        role="presentation"
      >
        <div
          className="dash-modal-panel pointer-events-auto flex max-h-[min(85vh,640px)] w-full max-w-xl flex-col overflow-hidden rounded-xl border shadow-xl"
          role="dialog"
          aria-label="Search"
          aria-modal="true"
          onMouseDown={(e) => e.stopPropagation()}
        >
        <div className="dash-modal-header flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-[var(--dash-text-subtle)]" strokeWidth={1.75} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="dash-command-palette-input min-h-[2.25rem] min-w-0 flex-1 bg-transparent py-2 text-sm text-[var(--dash-text-strong)] placeholder:text-[var(--dash-text-subtle)] focus:outline-none"
            aria-label="Search query"
          />
          <kbd className="dash-kbd hidden shrink-0 sm:inline-flex">Esc</kbd>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-2">
          {loadingRecords && trimmedQuery.length >= 2 ? (
            <p className="px-4 py-2 text-center text-xs text-[var(--dash-text-muted)]">Searching records…</p>
          ) : null}
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[var(--dash-text-muted)]">{emptyMessage}</p>
          ) : (
            <ul className="space-y-0.5">
              {entries.map((entry, i) => {
                if (entry.kind === 'section') {
                  return (
                    <li
                      key={entry.label}
                      className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-[var(--dash-text-subtle)]"
                    >
                      {entry.label}
                    </li>
                  );
                }
                const isSelected = i === flatSelected;
                if (entry.kind === 'nav') {
                  const Icon = entry.item.icon;
                  return (
                    <li key={`nav-${entry.item.href}`} data-index={i}>
                      <button
                        type="button"
                        onClick={() => handleSelectHref(entry.item.href)}
                        onMouseEnter={() => {
                          const pos = selectableIndexes.indexOf(i);
                          if (pos >= 0) setSelectedIndex(pos);
                        }}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                          isSelected
                            ? 'bg-[color-mix(in_srgb,var(--brand-primary)_12%,var(--dash-surface-solid))] text-[var(--dash-text-strong)]'
                            : 'text-[var(--dash-text)] hover:bg-[var(--dash-hover)]'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-[var(--dash-text-subtle)]" strokeWidth={1.75} />
                        <span className="min-w-0 flex-1 truncate font-medium">{entry.item.label}</span>
                        <span className="max-w-[40%] truncate text-[var(--dash-text-muted)]">
                          {entry.item.sectionLabel}
                        </span>
                      </button>
                    </li>
                  );
                }
                const Icon = RECORD_ICONS[entry.item.type];
                return (
                  <li key={`${entry.item.type}-${entry.item.id}`} data-index={i}>
                    <button
                      type="button"
                      onClick={() => handleSelectHref(entry.item.href)}
                      onMouseEnter={() => {
                        const pos = selectableIndexes.indexOf(i);
                        if (pos >= 0) setSelectedIndex(pos);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-[color-mix(in_srgb,var(--brand-primary)_12%,var(--dash-surface-solid))] text-[var(--dash-text-strong)]'
                          : 'text-[var(--dash-text)] hover:bg-[var(--dash-hover)]'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-[var(--dash-text-subtle)]" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate font-medium">{entry.item.label}</span>
                      {entry.item.subtitle ? (
                        <span className="max-w-[40%] truncate text-[var(--dash-text-muted)]">
                          {entry.item.subtitle}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="dash-modal-footer flex items-center justify-between gap-3 border-t px-4 py-2 text-xs text-[var(--dash-text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="dash-kbd inline-flex h-5 min-w-5 items-center justify-center px-1">
              <ArrowUp className="h-3 w-3" aria-hidden />
            </kbd>
            <kbd className="dash-kbd inline-flex h-5 min-w-5 items-center justify-center px-1">
              <ArrowDown className="h-3 w-3" aria-hidden />
            </kbd>
            <span>navigate</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="dash-kbd inline-flex h-5 items-center justify-center gap-0.5 px-1.5">
              <CornerDownLeft className="h-3 w-3" aria-hidden />
            </kbd>
            <span>open</span>
          </span>
        </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
