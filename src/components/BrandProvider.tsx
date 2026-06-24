'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PublicBrand } from '@/lib/brand';

export const BrandContext = createContext<PublicBrand | null>(null);

export function BrandProvider({ value, children }: { value: PublicBrand; children: ReactNode }) {
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function usePublicBrand(): PublicBrand {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error('usePublicBrand must be used within BrandProvider (root layout).');
  }
  return ctx;
}
