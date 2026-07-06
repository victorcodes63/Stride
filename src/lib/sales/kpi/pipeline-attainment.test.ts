import { describe, expect, it } from 'vitest';

import { computePipelineAttainmentPercent } from '@/lib/sales/kpi/pipeline-attainment-provider';

describe('sales.pipeline_attainment provider', () => {
  it('computes attainment percentage', () => {
    expect(computePipelineAttainmentPercent(850000, 1000000)).toBe(85);
    expect(computePipelineAttainmentPercent(0, 100)).toBe(0);
  });

  it('returns null for invalid target', () => {
    expect(computePipelineAttainmentPercent(100, 0)).toBeNull();
  });
});
