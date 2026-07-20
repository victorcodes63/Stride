import { describe, expect, it } from 'vitest';
import { clampProgress, parseProgress } from '@/lib/projects/progress';

describe('clampProgress', () => {
  it('keeps values within range', () => {
    expect(clampProgress(0)).toBe(0);
    expect(clampProgress(50)).toBe(50);
    expect(clampProgress(100)).toBe(100);
  });

  it('clamps out-of-range values', () => {
    expect(clampProgress(-10)).toBe(0);
    expect(clampProgress(140)).toBe(100);
  });

  it('rounds fractional values', () => {
    expect(clampProgress(33.4)).toBe(33);
    expect(clampProgress(66.6)).toBe(67);
  });

  it('treats non-finite values as 0', () => {
    expect(clampProgress(Number.NaN)).toBe(0);
    expect(clampProgress(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('parseProgress', () => {
  it('returns undefined for non-numbers', () => {
    expect(parseProgress('50')).toBeUndefined();
    expect(parseProgress(null)).toBeUndefined();
    expect(parseProgress(undefined)).toBeUndefined();
    expect(parseProgress(Number.NaN)).toBeUndefined();
  });

  it('clamps valid numbers', () => {
    expect(parseProgress(120)).toBe(100);
    expect(parseProgress(-5)).toBe(0);
    expect(parseProgress(42)).toBe(42);
  });
});
