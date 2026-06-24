'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';

type Props = {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
};

export function EssPullRefresh({ onRefresh, children, className = '' }: Props) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pull = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    startY.current = e.touches[0]?.clientY ?? 0;
    pull.current = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0 || refreshing) return;
    const y = e.touches[0]?.clientY ?? 0;
    pull.current = Math.max(0, Math.min(80, y - startY.current));
    setPulling(pull.current > 20);
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (pull.current < 50 || refreshing) {
      setPulling(false);
      pull.current = 0;
      return;
    }
    setRefreshing(true);
    setPulling(false);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      pull.current = 0;
    }
  }, [onRefresh, refreshing]);

  return (
    <div
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => void onTouchEnd()}
    >
      {(pulling || refreshing) && (
        <p className="text-center text-xs text-neutral-500 py-2">
          {refreshing ? 'Refreshing…' : 'Release to refresh'}
        </p>
      )}
      {children}
    </div>
  );
}
