/**
 * Client/edge-safe deployment mode flags — no server-only imports.
 */

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

export function isDemoMode(): boolean {
  return parseBoolean(trimEnv('DEMO_MODE'), false);
}

export function isPublicDemoMode(): boolean {
  return parseBoolean(trimEnv('NEXT_PUBLIC_DEMO_MODE'), isDemoMode());
}

/** Local dev: license every module without control-plane entitlements (see .env.example). */
export function isLocalDevAllModules(): boolean {
  return parseBoolean(trimEnv('LOCAL_DEV_ALL_MODULES'), false);
}

export function isPublicLocalDevAllModules(): boolean {
  return parseBoolean(trimEnv('NEXT_PUBLIC_LOCAL_DEV_ALL_MODULES'), isLocalDevAllModules());
}
