import {
  MODULE_ADMIN_COOKIE,
  sanitizeModuleAdminFlags,
  type ModuleKey,
} from '@/lib/modules';

export function serializeModuleAdminFlags(flags: Record<ModuleKey, boolean>): string {
  return encodeURIComponent(JSON.stringify(flags));
}

export function parseModuleAdminFlagsCookie(value: string | undefined): Record<ModuleKey, boolean> | null {
  if (!value) return null;
  try {
    const decoded = value.startsWith('%') ? decodeURIComponent(value) : value;
    return sanitizeModuleAdminFlags(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export function moduleAdminFlagsSetCookieHeader(flags: Record<ModuleKey, boolean>): string {
  return `${MODULE_ADMIN_COOKIE}=${serializeModuleAdminFlags(flags)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Client-side sync after loading /api/config/deployment */
export function writeModuleAdminFlagsCookie(flags: Record<ModuleKey, boolean>) {
  if (typeof document === 'undefined') return;
  document.cookie = moduleAdminFlagsSetCookieHeader(flags);
}
