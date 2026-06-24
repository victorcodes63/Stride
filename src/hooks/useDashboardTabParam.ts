'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type UseDashboardTabParamOptions<T extends string> = {
  /** When false, waits before applying resolveDefault (e.g. while loading permissions). */
  ready?: boolean;
  /** Used when the URL has no valid tab and ready becomes true. */
  resolveDefault?: () => T;
  /** Write tab changes to the URL. Default true. */
  syncToUrl?: boolean;
  /** Map URL values to tab ids (e.g. legacy aliases). */
  parseTab?: (raw: string | null) => T | null;
};

function isAllowedTab<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

/**
 * URL-backed tab state for dashboard pages.
 * Reads `?{paramKey}=` on load; updates the URL when the user switches tabs.
 */
export function useDashboardTabParam<T extends string>(
  paramKey: string,
  allowed: readonly T[],
  fallback: T,
  options?: UseDashboardTabParamOptions<T>,
): { tab: T; setTab: (next: T) => void; isReady: boolean } {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ready = options?.ready ?? true;
  const syncToUrl = options?.syncToUrl ?? true;
  const parseTab = options?.parseTab;
  const resolveDefaultRef = useRef(options?.resolveDefault);
  resolveDefaultRef.current = options?.resolveDefault;

  const readFromUrl = useCallback((): T | null => {
    const raw = searchParams.get(paramKey);
    const parsed = parseTab ? parseTab(raw) : raw;
    if (parsed && isAllowedTab(parsed, allowed)) return parsed;
    if (raw && isAllowedTab(raw, allowed)) return raw;
    return null;
  }, [allowed, paramKey, parseTab, searchParams]);

  const [tab, setTabState] = useState<T>(fallback);
  const [isReady, setIsReady] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!ready || initializedRef.current) return;

    const fromUrl = readFromUrl();
    if (fromUrl) {
      setTabState(fromUrl);
      initializedRef.current = true;
      setIsReady(true);
      return;
    }

    const resolved = resolveDefaultRef.current?.() ?? fallback;
    setTabState(resolved);
    initializedRef.current = true;
    setIsReady(true);

    if (syncToUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.set(paramKey, resolved);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [ready, readFromUrl, fallback, syncToUrl, paramKey, pathname, router, searchParams]);

  useEffect(() => {
    if (!isReady) return;
    const fromUrl = readFromUrl();
    if (fromUrl && fromUrl !== tab) {
      setTabState(fromUrl);
    }
  }, [isReady, readFromUrl, tab]);

  const setTab = useCallback(
    (next: T) => {
      if (!isAllowedTab(next, allowed)) return;
      setTabState(next);
      if (!syncToUrl) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set(paramKey, next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [allowed, paramKey, pathname, router, searchParams, syncToUrl],
  );

  return { tab: isReady ? tab : fallback, setTab, isReady };
}
