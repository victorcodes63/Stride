'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { DASHBOARD_THEME_STORAGE_KEY } from '@/lib/dashboard-appearance';

export function DashboardThemeProvider({
  children,
  forcedTheme,
}: {
  children: ReactNode;
  /** Marketing deploys always stay light so product previews match the brand site. */
  forcedTheme?: 'light';
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={!forcedTheme}
      forcedTheme={forcedTheme}
      storageKey={DASHBOARD_THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
