/** Default brand theme colors — Stride palette. */
export const DEFAULT_PRIMARY_COLOR = '#FF5436';
export const DEFAULT_SECONDARY_COLOR = '#1A1714';

const HEX = /^#([0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX.test(value.trim());
}

function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().match(HEX);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function mix(hex: string, target: 'white' | 'black', amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const t = target === 'white' ? 255 : 0;
  return toHex(r + (t - r) * amount, g + (t - g) * amount, b + (t - b) * amount);
}

export function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const t = value.trim();
  const withHash = t.startsWith('#') ? t : `#${t}`;
  return isValidHexColor(withHash) ? withHash.toUpperCase() : fallback;
}

/** Build CSS custom properties for runtime theming (primary + secondary scales). */
export function buildBrandThemeCssVars(primaryHex: string, secondaryHex: string): Record<string, string> {
  const primary = sanitizeHexColor(primaryHex, DEFAULT_PRIMARY_COLOR);
  const secondary = sanitizeHexColor(secondaryHex, DEFAULT_SECONDARY_COLOR);

  return {
    '--brand-primary': primary,
    '--brand-primary-hover': mix(primary, 'black', 0.12),
    '--brand-primary-pressed': mix(primary, 'black', 0.22),
    '--brand-navy': secondary,
    '--brand-ink': secondary,
    '--color-primary-50': mix(primary, 'white', 0.94),
    '--color-primary-100': mix(primary, 'white', 0.88),
    '--color-primary-200': mix(primary, 'white', 0.72),
    '--color-primary-300': mix(primary, 'white', 0.52),
    '--color-primary-400': mix(primary, 'white', 0.28),
    '--color-primary-500': primary,
    '--color-primary-600': mix(primary, 'black', 0.08),
    '--color-primary-700': mix(primary, 'black', 0.18),
    '--color-primary-800': mix(primary, 'black', 0.32),
    '--color-primary-900': mix(primary, 'black', 0.48),
    '--color-secondary-50': mix(secondary, 'white', 0.94),
    '--color-secondary-100': mix(secondary, 'white', 0.88),
    '--color-secondary-500': secondary,
    '--color-secondary-600': mix(secondary, 'black', 0.08),
    '--color-secondary-700': mix(secondary, 'black', 0.18),
    '--color-secondary-900': mix(secondary, 'black', 0.48),
  };
}
