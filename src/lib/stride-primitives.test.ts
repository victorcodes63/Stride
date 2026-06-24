import { describe, expect, it } from 'vitest';
import { strideButtonClass, strideCardClass, strideInputClass } from './stride-primitives';

describe('stride-primitives (RAV-115)', () => {
  it('maps dashboard primary button', () => {
    expect(strideButtonClass({ surface: 'dashboard', variant: 'primary' })).toBe('btn-primary');
  });

  it('maps public small primary button', () => {
    expect(strideButtonClass({ surface: 'public', variant: 'primary', size: 'sm' })).toContain(
      'pub-btn-primary',
    );
    expect(strideButtonClass({ surface: 'public', variant: 'primary', size: 'sm' })).toContain(
      'pub-btn-primary--sm',
    );
  });

  it('maps ess input and card', () => {
    expect(strideInputClass({ surface: 'ess' })).toBe('ess-field');
    expect(strideCardClass({ surface: 'ess' })).toBe('ess-card');
    expect(strideCardClass({ surface: 'ess', flat: true })).toBe('ess-card-flat');
  });
});
