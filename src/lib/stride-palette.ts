/**
 * Canonical Stride design tokens — single source for dashboard, public, and ESS surfaces.
 * CSS mirror: `src/styles/stride-palette.css` (keep in sync).
 * Consumers: brand-theme.ts, brand.config.ts, tailwind fallbacks, manifest theme_color.
 */

export const STRIDE_PALETTE = {
  /** Primary CTA / links — marketing wordmark coral */
  coral: '#FF5436',
  coralDeep: '#E63E22',
  coralPressed: '#C9341B',
  coralSubtle: '#FFE9E4',
  coralMuted: '#FFCFC4',
  coralBorder: '#FFC9BE',
  coralFg: '#C9341B',

  /** Structural ink + warm paper neutrals */
  ink: '#1A1714',
  inkMuted: '#3D3833',
  inkSubtle: '#8A8076',
  paper: '#FBF8F4',
  paper2: '#F4EFE8',
  line: '#E6DED4',
  lineStrong: '#D8CDBF',
  warmMuted: '#C9C0B6',
  warmSubtle: '#8A8076',

  /** Semantic */
  success: '#15803D',
  successSubtle: '#DCFCE7',
  warning: '#B45309',
  warningSubtle: '#FEF3C7',
  danger: '#B91C1C',
  dangerSubtle: '#FEE2E2',
  info: '#1A1714',
} as const;

export type StridePalette = typeof STRIDE_PALETTE;

/** Dashboard / runtime brand defaults — tenants may override primary via company setup. */
export const STRIDE_BRAND_PRIMARY = STRIDE_PALETTE.coral;
export const STRIDE_BRAND_SECONDARY = STRIDE_PALETTE.ink;

/** PWA chrome */
export const STRIDE_MANIFEST_BACKGROUND = STRIDE_PALETTE.paper;
export const STRIDE_MANIFEST_THEME_COLOR = STRIDE_PALETTE.ink;

/** Locked brand triple — RAV-157 verification anchor */
export const STRIDE_LOCKED_BRAND = {
  coral: STRIDE_PALETTE.coral,
  ink: STRIDE_PALETTE.ink,
  paper: STRIDE_PALETTE.paper,
} as const;

/** Legacy primaries retired in RAV-108 / RAV-157 — must not appear in src/ */
export const STRIDE_BANNED_LEGACY_HEX = [
  '#ff6118',
  '#0d9488',
  '#0088ff',
  '#1d2460',
] as const;

/** Excel / Office ARGB (alpha + RRGGBB) from a locked hex token */
export function strideHexToArgb(hex: string): string {
  const normalized = sanitizeStrideHexColor(hex, STRIDE_PALETTE.ink).slice(1);
  return `FF${normalized}`;
}

const HEX = /^#([0-9a-fA-F]{6})$/;

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

export function sanitizeStrideHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const t = value.trim();
  const withHash = t.startsWith('#') ? t : `#${t}`;
  return HEX.test(withHash) ? withHash.toUpperCase() : fallback;
}

/** Tailwind primary/secondary scales — tenant company setup may override at runtime. */
export function buildStrideBrandScaleCssVars(
  primaryHex: string = STRIDE_BRAND_PRIMARY,
  secondaryHex: string = STRIDE_BRAND_SECONDARY,
): Record<string, string> {
  const primary = sanitizeStrideHexColor(primaryHex, STRIDE_BRAND_PRIMARY);
  const secondary = sanitizeStrideHexColor(secondaryHex, STRIDE_BRAND_SECONDARY);

  return {
    '--brand-primary': primary,
    '--brand-primary-hover': mix(primary, 'black', 0.12),
    '--brand-primary-pressed': mix(primary, 'black', 0.22),
    '--brand-primary-subtle': mix(primary, 'white', 0.88),
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
    '--color-secondary-200': STRIDE_PALETTE.lineStrong,
    '--color-secondary-300': '#B8ADA0',
    '--color-secondary-400': STRIDE_PALETTE.inkSubtle,
    '--color-secondary-500': secondary,
    '--color-secondary-600': mix(secondary, 'black', 0.08),
    '--color-secondary-700': mix(secondary, 'black', 0.18),
    '--color-secondary-800': mix(secondary, 'black', 0.32),
    '--color-secondary-900': mix(secondary, 'black', 0.48),
  };
}

/**
 * CSS custom properties for :root — studio-craft, public, and dashboard aliases.
 * Tenant runtime theming still uses buildBrandThemeCssVars() for primary scale overrides.
 */
export function stridePaletteCssVars(): Record<string, string> {
  const p = STRIDE_PALETTE;
  return {
    ...buildStrideBrandScaleCssVars(),
    '--stride-coral': p.coral,
    '--stride-coral-deep': p.coralDeep,
    '--stride-ink': p.ink,
    '--stride-paper': p.paper,
    '--stride-logo': p.coral,

    '--sc-coral': p.coral,
    '--sc-coral-deep': p.coralDeep,
    '--sc-ink': p.ink,
    '--sc-ink-muted': p.inkMuted,
    '--sc-ink-subtle': p.inkSubtle,
    '--sc-paper': p.paper,
    '--sc-paper-2': p.paper2,
    '--sc-line': p.line,

    '--brand-navy-subtle': p.paper2,
    '--brand-canvas': p.paper,

    '--pub-primary': p.coral,
    '--pub-primary-hover': mix(p.coral, 'black', 0.12),
    '--pub-primary-pressed': p.coralPressed,
    '--pub-primary-subtle': p.coralSubtle,
    '--pub-primary-muted': p.coralMuted,
    '--pub-ink': p.ink,
    '--pub-ink-muted': p.inkMuted,
    '--pub-ink-subtle': p.inkSubtle,
    '--pub-surface': p.paper,
    '--pub-surface-muted': p.paper2,
    '--pub-border': p.line,
    '--pub-border-strong': p.lineStrong,
    '--pub-gradient-start': p.coral,
    '--pub-gradient-mid': p.coralSubtle,
    '--pub-gradient-end': p.coralDeep,

    '--neutral-50': p.paper2,
    '--neutral-100': '#EDE6DC',
    '--neutral-200': p.line,
    '--neutral-400': p.inkSubtle,
    '--neutral-500': p.inkSubtle,
    '--neutral-700': p.inkMuted,
    '--neutral-900': p.ink,

    '--success': p.success,
    '--success-subtle': p.successSubtle,
    '--warning': p.warning,
    '--warning-subtle': p.warningSubtle,
    '--danger': p.danger,
    '--danger-subtle': p.dangerSubtle,
    '--info': p.info,
  };
}
