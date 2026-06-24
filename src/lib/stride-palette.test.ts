import { describe, expect, it } from 'vitest';
import {
  STRIDE_BRAND_PRIMARY,
  STRIDE_PALETTE,
  buildStrideBrandScaleCssVars,
  stridePaletteCssVars,
} from './stride-palette';

describe('stride-palette (RAV-112 / RAV-113)', () => {
  it('uses coral + ink as brand primaries', () => {
    expect(STRIDE_BRAND_PRIMARY).toBe('#FF5436');
    expect(STRIDE_PALETTE.ink).toBe('#1A1714');
  });

  it('exports studio-craft and dashboard CSS aliases', () => {
    const vars = stridePaletteCssVars();
    expect(vars['--sc-coral']).toBe(STRIDE_PALETTE.coral);
    expect(vars['--brand-primary']).toBe(STRIDE_PALETTE.coral);
    expect(vars['--pub-primary']).toBe(STRIDE_PALETTE.coral);
    expect(vars['--neutral-700']).toBe(STRIDE_PALETTE.inkMuted);
  });

  it('exports primary scale for Tailwind', () => {
    const scale = buildStrideBrandScaleCssVars();
    expect(scale['--color-primary-500']).toBe(STRIDE_PALETTE.coral);
    expect(scale['--color-secondary-500']).toBe(STRIDE_PALETTE.ink);
  });
});
