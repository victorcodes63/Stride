import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  STRIDE_BANNED_LEGACY_HEX,
  STRIDE_LOCKED_BRAND,
  STRIDE_PALETTE,
  stridePaletteCssVars,
} from './stride-palette';

const SRC_ROOT = join(process.cwd(), 'src');
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.css']);

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full));
      continue;
    }
    const ext = entry.slice(entry.lastIndexOf('.'));
    if (!SCAN_EXTENSIONS.has(ext) || entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) {
      continue;
    }
    if (entry === 'stride-palette.ts') continue;
    files.push(full);
  }
  return files;
}

describe('stride-palette RAV-157 locked brand', () => {
  it('exports the locked coral / ink / paper triple', () => {
    expect(STRIDE_LOCKED_BRAND.coral).toBe('#FF5436');
    expect(STRIDE_LOCKED_BRAND.ink).toBe('#1A1714');
    expect(STRIDE_LOCKED_BRAND.paper).toBe('#FBF8F4');
    expect(STRIDE_PALETTE.paper).toBe(STRIDE_LOCKED_BRAND.paper);
  });

  it('maps CSS aliases to locked primaries', () => {
    const vars = stridePaletteCssVars();
    expect(vars['--brand-primary']).toBe(STRIDE_LOCKED_BRAND.coral);
    expect(vars['--brand-ink']).toBe(STRIDE_LOCKED_BRAND.ink);
    expect(vars['--stride-paper']).toBe(STRIDE_LOCKED_BRAND.paper);
    expect(vars['--pub-gradient-start']).toBe(STRIDE_LOCKED_BRAND.coral);
  });

  it('has no retired legacy primaries anywhere under src/', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_ROOT)) {
      const content = readFileSync(file, 'utf8');
      for (const hex of STRIDE_BANNED_LEGACY_HEX) {
        if (content.toLowerCase().includes(hex)) {
          offenders.push(`${relative(process.cwd(), file)} contains ${hex}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
