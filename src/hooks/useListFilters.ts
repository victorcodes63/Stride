'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type FilterRecord = Record<string, string>;

type UseListFiltersOptions = {
  /** Persist filter values in the URL. Default true. */
  syncToUrl?: boolean;
  /** Keys excluded from hasActiveFilters / clearFilters. */
  ignoreActive?: string[];
};

function readFiltersFromUrl(searchParams: URLSearchParams, keys: readonly string[]): FilterRecord {
  const out: FilterRecord = {};
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value !== null) out[key] = value;
  }
  return out;
}

/**
 * List filter state with optional URL sync.
 * Use for search, status selects, and other shareable list views.
 */
export function useListFilters(
  keys: readonly string[],
  defaults: FilterRecord,
  options?: UseListFiltersOptions,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const syncToUrl = options?.syncToUrl ?? true;
  const ignoreActive = options?.ignoreActive ?? [];
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const [filters, setFilters] = useState<FilterRecord>(() => {
    if (!syncToUrl) return { ...defaultsRef.current };
    const fromUrl = readFiltersFromUrl(searchParams, keys);
    return { ...defaultsRef.current, ...fromUrl };
  });

  useEffect(() => {
    if (!syncToUrl) return;
    const fromUrl = readFiltersFromUrl(searchParams, keys);
    setFilters((prev) => {
      const next = { ...defaultsRef.current, ...fromUrl };
      const changed = keys.some((key) => prev[key] !== next[key]);
      return changed ? next : prev;
    });
  }, [keys, searchParams, syncToUrl]);

  const setFilter = useCallback(
    (key: string, value: string) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value };
        if (!syncToUrl) return next;

        const params = new URLSearchParams(searchParams.toString());
        if (!value || value === defaultsRef.current[key]) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        return next;
      });
    },
    [pathname, router, searchParams, syncToUrl],
  );

  const clearFilters = useCallback(() => {
    setFilters({ ...defaultsRef.current });
    if (!syncToUrl) return;

    const params = new URLSearchParams(searchParams.toString());
    for (const key of keys) {
      params.delete(key);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [keys, pathname, router, searchParams, syncToUrl]);

  const hasActiveFilters = useMemo(
    () =>
      keys.some((key) => {
        if (ignoreActive.includes(key)) return false;
        return (filters[key] ?? '') !== (defaultsRef.current[key] ?? '');
      }),
    [filters, ignoreActive, keys],
  );

  return {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
  };
}
