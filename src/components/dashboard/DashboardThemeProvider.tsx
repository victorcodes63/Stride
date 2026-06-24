'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { DASHBOARD_THEME_STORAGE_KEY } from '@/lib/dashboard-appearance';

export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={DASHBOARD_THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
