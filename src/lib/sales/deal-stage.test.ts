import { describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({}));

import { defaultForecastForStage, defaultProbabilityForStage } from '@/lib/sales/schema';

describe('moveDealStage helpers (unit contract)', () => {
  it('won resets probability and omits forecast', () => {
    expect(defaultProbabilityForStage('won')).toBe(100);
    expect(defaultForecastForStage('won')).toBe('omitted');
  });

  it('lost clears probability', () => {
    expect(defaultProbabilityForStage('lost')).toBe(0);
    expect(defaultForecastForStage('lost')).toBe('omitted');
  });
});
