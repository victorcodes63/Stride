'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ReactLenis, useLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';

/** Reset scroll position on App Router navigations (Lenis owns window scroll). */
function LenisRouteScrollReset() {
  const pathname = usePathname();
  const lenis = useLenis();

  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
  }, [pathname, lenis]);

  return null;
}

type MarketingLenisProps = {
  children: ReactNode;
};

/**
 * Smooth scrolling for the public marketing surface only.
 * Uses Lenis root mode (native window scroll) so sticky nav + anchors keep working.
 */
export function MarketingLenis({ children }: MarketingLenisProps) {
  return (
    <ReactLenis
      root
      options={{
        autoRaf: true,
        anchors: true,
        allowNestedScroll: true,
        stopInertiaOnNavigate: true,
      }}
    >
      <LenisRouteScrollReset />
      {children}
    </ReactLenis>
  );
}
