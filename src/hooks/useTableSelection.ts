'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * Bulk row-selection state for data tables. Tracks a set of selected ids and
 * derives header-checkbox state (all/none/some) against the currently visible rows.
 */
export function useTableSelection<T extends string = string>(visibleIds: T[]) {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const isSelected = useCallback((id: T) => selected.has(id), [selected]);

  const visibleSelectedCount = useMemo(
    () => visibleIds.reduce((acc, id) => (selected.has(id) ? acc + 1 : acc), 0),
    [visibleIds, selected],
  );

  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }, [visibleIds]);

  return {
    selectedIds: useMemo(() => Array.from(selected), [selected]),
    selectedCount: selected.size,
    isSelected,
    toggle,
    toggleAllVisible,
    clear,
    allVisibleSelected,
    someVisibleSelected,
    hasSelection: selected.size > 0,
  };
}
