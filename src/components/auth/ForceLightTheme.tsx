'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

/**
 * Login / password surfaces are white + coral. Clear any saved dashboard
 * dark preference for this route tree so inputs don't paint black.
 */
export function ForceLightTheme({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme('light');
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }, [setTheme]);

  return <>{children}</>;
}
