'use client';

import { useCallback, useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export type SortState<K extends string> = {
  key: K;
  direction: SortDirection;
};

/**
 * Column-sort state for data tables. Clicking the active column flips direction;
 * clicking a new column sorts ascending. Pair `sort` with server queries or the
 * provided `comparator` helper for client-side sorting.
 */
export function useSortableTable<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const toggleSort = useCallback((key: K) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  }, []);

  const getSortDirection = useCallback(
    (key: K): SortDirection | null => (sort.key === key ? sort.direction : null),
    [sort],
  );

  const comparator = useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    return (a: Record<K, unknown>, b: Record<K, unknown>) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    };
  }, [sort]);

  return { sort, setSort, toggleSort, getSortDirection, comparator };
}
