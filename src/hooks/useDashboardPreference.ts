'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'hris-dashboard:';

function readPreference<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writePreference<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Ignore quota / private mode errors.
  }
}

/**
 * Persist UI preferences (table density, collapsed panels, etc.) in localStorage.
 * Not for shareable work context — use URL params for filters and tabs.
 */
export function useDashboardPreference<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(readPreference(key, defaultValue));
    setHydrated(true);
  }, [defaultValue, key]);

  const setPreference = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        writePreference(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [hydrated ? value : defaultValue, setPreference, hydrated] as const;
}
