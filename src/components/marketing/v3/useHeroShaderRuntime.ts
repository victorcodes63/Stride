'use client';

import { useEffect, useState } from 'react';

export type HeroShaderRuntime = 'pending' | 'static' | 'css' | 'webgl';

/**
 * Prefer lighter fallbacks on low-power devices and when users request reduced motion.
 * Desktop uses the full live WebGL stack (grain → fluted glass → chroma → swirl).
 */
export function useHeroShaderRuntime(): HeroShaderRuntime {
  const [runtime, setRuntime] = useState<HeroShaderRuntime>('css');

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow = window.matchMedia('(max-width: 767px)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const saveData =
      typeof navigator !== 'undefined' &&
      'connection' in navigator &&
      Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const lowMemory =
      typeof navigator !== 'undefined' &&
      'deviceMemory' in navigator &&
      Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory) > 0 &&
      Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory) <= 4;

    if (reducedMotion || saveData) {
      setRuntime('static');
      return;
    }

    if ((narrow && coarsePointer) || lowMemory) {
      setRuntime('css');
      return;
    }

    setRuntime('webgl');
  }, []);

  return runtime;
}

export function useHeroShaderTabVisible(enabled: boolean) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    const onVisibility = () => {
      setVisible(document.visibilityState === 'visible');
    };

    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled]);

  return visible;
}
