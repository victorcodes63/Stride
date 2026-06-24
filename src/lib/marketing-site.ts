import { isDemoMode, isPublicDemoMode } from '@/lib/deployment-config';
import { isModuleLicensed } from '@/lib/modules';

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function parseBoolean(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined || v === '') return defaultValue;
  const n = v.trim().toLowerCase();
  if (n === '1' || n === 'true' || n === 'yes' || n === 'on') return true;
  if (n === '0' || n === 'false' || n === 'no' || n === 'off') return false;
  return defaultValue;
}

/**
 * Demo / legacy deployments keep the old `/` redirect behaviour.
 * Production Stride marketing site shows when this returns false.
 */
export function shouldUseLegacyHomeRedirect(): boolean {
  if (isDemoMode() || isPublicDemoMode()) return true;
  return parseBoolean(trimEnv('NEXT_PUBLIC_HOME_LEGACY_REDIRECT'), false);
}

/** Resolve legacy home redirect target (matches pre-marketing behaviour). */
export function getLegacyHomeRedirectPath(): string {
  if (isModuleLicensed('ats')) return '/careers';
  return '/dashboard/login';
}

/**
 * Public Stride surfaces (marketing / app subdomain) — login must not expose
 * tenant org names or seeded demo emails. Internal demo sandboxes opt in via
 * DEMO_MODE or NEXT_PUBLIC_TENANT_LOGIN_BRANDING=true.
 */
export function isGenericPublicLogin(): boolean {
  if (parseBoolean(trimEnv('NEXT_PUBLIC_GENERIC_PUBLIC_LOGIN'), false)) return true;
  if (parseBoolean(trimEnv('NEXT_PUBLIC_TENANT_LOGIN_BRANDING'), false)) return false;
  if (isDemoMode() || isPublicDemoMode()) return false;
  return Boolean(trimEnv('NEXT_PUBLIC_MARKETING_DOMAIN'));
}
