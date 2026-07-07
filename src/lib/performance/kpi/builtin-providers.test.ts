import { describe, expect, it } from 'vitest';

import { BUILTIN_KPI_PROVIDERS } from '@/lib/performance/kpi/builtin-providers';

describe('builtin KPI providers', () => {
  it('registers at least three cross-module keys', () => {
    expect(BUILTIN_KPI_PROVIDERS.length).toBeGreaterThanOrEqual(3);
    const keys = BUILTIN_KPI_PROVIDERS.map((p) => p.key);
    expect(keys).toContain('time.attendance_rate');
    expect(keys).toContain('ats.time_to_hire_days');
    expect(keys).toContain('hr.headcount_turnover_pct');
  });
});
