import {
  allModulesAdminEnabled,
  MODULE_ADMIN_COOKIE,
  sanitizeModuleAdminFlags,
} from '@/lib/module-admin-flags';

export { MODULE_ADMIN_COOKIE, sanitizeModuleAdminFlags, allModulesAdminEnabled };

export function serializeModuleAdminFlags(flags: Record<string, boolean>): string {
  return encodeURIComponent(JSON.stringify(flags));
}

export function parseModuleAdminFlagsCookie(value: string | undefined): Record<string, boolean> | null {
  if (!value) return null;
  try {
    const decoded = value.startsWith('%') ? decodeURIComponent(value) : value;
    return sanitizeModuleAdminFlags(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export function moduleAdminFlagsSetCookieHeader(flags: Record<string, boolean>): string {
  return `${MODULE_ADMIN_COOKIE}=${serializeModuleAdminFlags(flags)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Client-side sync after loading /api/config/deployment */
export function writeModuleAdminFlagsCookie(flags: Record<string, boolean>) {
  if (typeof document === 'undefined') return;
  document.cookie = moduleAdminFlagsSetCookieHeader(flags);
}
