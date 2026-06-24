/** Client-safe brand constants (no server imports). */

/** Official Stride wordmark — coral lowercase logotype with accent square. */
export const STRIDE_WORDMARK_SRC = '/brand/stride-wordmark.svg';

/** Circular gradient mark — favicon, compact UI, app icon. */
export const STRIDE_MARK_SRC = '/brand/stride-mark.svg';

/** Default product logo (mark) for dashboard, favicon, and metadata fallbacks. */
export const DEFAULT_BRAND_LOGO_SRC = STRIDE_MARK_SRC;

/** Legacy platform marks — remapped to {@link DEFAULT_BRAND_LOGO_SRC} at resolve time. */
const LEGACY_LOGO_SUFFIXES = [
  'stride-mark.svg',
  'hris-demo-mark.svg',
  'hris-demo-mark.png',
  'platform-logo.png',
  'platform-logo.svg',
] as const;

/** Legacy product display names — remapped to current Stride identity at resolve time. */
const LEGACY_PRODUCT_NAMES = ['imara', 'hris demo', 'hris'] as const;

export function isLegacyProductDisplayName(name: string): boolean {
  const t = name.trim().toLowerCase();
  return LEGACY_PRODUCT_NAMES.includes(t as (typeof LEGACY_PRODUCT_NAMES)[number]);
}

/** Normalize stored product name for user-visible surfaces. */
export function normalizeProductDisplayName(name: string, fallback: string): string {
  const t = name.trim();
  if (!t || isLegacyProductDisplayName(t)) return fallback;
  return t;
}

/** Replace legacy product names in seeded login / footer copy. */
export function normalizeLegacyProductCopy(text: string, productName: string): string {
  let result = text.trim();
  if (!result) return '';
  for (const legacy of ['Imara', 'HRIS Demo', 'HRIS']) {
    result = result.replace(new RegExp(`\\b${legacy}\\b`, 'gi'), productName);
  }
  return result;
}

export function isLegacyPlatformLogo(src: string): boolean {
  const t = src.trim().replace(/^\//, '');
  return LEGACY_LOGO_SUFFIXES.some((suffix) => t.endsWith(suffix));
}

/** Normalize logo paths so seeded / env defaults pick up the current platform mark. */
export function normalizeLogoSrc(src: string): string {
  const t = src.trim();
  if (!t || isLegacyPlatformLogo(t)) return DEFAULT_BRAND_LOGO_SRC;
  return t.startsWith('/') ? t : `/${t}`;
}

export const DEFAULT_LANDING_PATH = '/dashboard';

export const LANDING_PATH_OPTIONS = [
  { value: '/dashboard', label: 'Dashboard home' },
  { value: '/dashboard/employees', label: 'Employees' },
  { value: '/dashboard/leave', label: 'Leave' },
  { value: '/dashboard/payroll', label: 'Payroll' },
] as const;
