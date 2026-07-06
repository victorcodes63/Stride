/**
 * Client-safe deployment mode flags (no server-only imports).
 */
import { isDemoMode, isPublicDemoMode } from '@/lib/deployment-config';

export { isDemoMode, isPublicDemoMode };

function parseBoolean(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined || v === '') return defaultValue;
  const n = v.trim().toLowerCase();
  if (n === '1' || n === 'true' || n === 'yes' || n === 'on') return true;
  if (n === '0' || n === 'false' || n === 'no' || n === 'off') return false;
  return defaultValue;
}

/** Local dev: license every module without control-plane entitlements (see .env.example). */
export function isLocalDevAllModules(): boolean {
  const raw = process.env.LOCAL_DEV_ALL_MODULES ?? process.env.NEXT_PUBLIC_LOCAL_DEV_ALL_MODULES;
  return parseBoolean(typeof raw === 'string' ? raw : undefined, false);
}
