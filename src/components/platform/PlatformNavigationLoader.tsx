'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PlatformLoadingOverlay } from '@/components/platform/PlatformLoadingOverlay';

const PLATFORM_PREFIXES = ['/dashboard', '/ess'] as const;

function isPlatformPath(pathname: string) {
  return PLATFORM_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function shouldShowNavigationLoader(href: string) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(href, window.location.origin);
  } catch {
    return false;
  }

  if (url.origin !== window.location.origin) return false;
  if (!isPlatformPath(url.pathname)) return false;

  const next = `${url.pathname}${url.search}`;
  const current = `${window.location.pathname}${window.location.search}`;
  return next !== current;
}

export function PlatformNavigationLoader() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || !shouldShowNavigationLoader(href)) return;

      setPending(true);
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  if (!pending) return null;
  return <PlatformLoadingOverlay />;
}
