/**
 * Per-deployment site split — RAV-170 (A13.1).
 * stride-app → marketing | stride-platform → app
 */

import { getMarketingSiteUrl, MARKETING_APP_ORIGIN } from '@/lib/marketing-config';

export type SiteMode = 'marketing' | 'app' | 'unified';

const MARKETING_PREFIXES = [
  '/platform',
  '/industries',
  '/pricing',
  '/about',
  '/contact',
  '/demo-access',
  '/v3',
] as const;

const MARKETING_EXACT = new Set(['/', '/privacy', '/terms']);

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function parseSiteMode(value: string | undefined): SiteMode | null {
  if (!value) return null;
  const n = value.trim().toLowerCase();
  if (n === 'marketing' || n === 'stride-app') return 'marketing';
  if (n === 'app' || n === 'stride-platform' || n === 'platform') return 'app';
  if (n === 'unified' || n === 'all') return 'unified';
  return null;
}

/** Resolve deploy mode from SITE_MODE or marketing/app env hints. */
export function getSiteMode(): SiteMode {
  const explicit = parseSiteMode(trimEnv('SITE_MODE'));
  if (explicit && explicit !== 'unified') return explicit;

  if (trimEnv('NEXT_PUBLIC_MARKETING_DOMAIN')) return 'marketing';

  const siteUrl = trimEnv('NEXT_PUBLIC_SITE_URL');
  const appOrigin = trimEnv('NEXT_PUBLIC_APP_ORIGIN') ?? MARKETING_APP_ORIGIN;
  if (siteUrl) {
    try {
      const siteHost = new URL(siteUrl).host;
      const appHost = new URL(appOrigin).host;
      if (siteHost === appHost && !trimEnv('NEXT_PUBLIC_MARKETING_DOMAIN')) {
        return 'app';
      }
    } catch {
      /* fall through */
    }
  }

  return 'unified';
}

export function getMarketingOrigin(): string {
  return getMarketingSiteUrl().replace(/\/$/, '');
}

export function getAppOrigin(): string {
  return (trimEnv('NEXT_PUBLIC_APP_ORIGIN') ?? MARKETING_APP_ORIGIN).replace(/\/$/, '');
}

export function isMarketingPath(pathname: string): boolean {
  if (MARKETING_EXACT.has(pathname)) return true;
  return MARKETING_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Product, auth, and non-marketing APIs — live on the app deploy. */
export function isAppPath(pathname: string): boolean {
  if (pathname.startsWith('/dashboard')) return true;
  if (pathname.startsWith('/ess')) return true;
  if (pathname.startsWith('/careers')) return true;
  if (pathname.startsWith('/interview')) return true;
  if (pathname.startsWith('/api/marketing/')) return false;
  if (pathname.startsWith('/api/')) return true;
  return false;
}

export function buildCrossOriginUrl(origin: string, pathname: string, search: string): URL {
  const url = new URL(pathname, origin.endsWith('/') ? origin : `${origin}/`);
  if (search) url.search = search;
  return url;
}
