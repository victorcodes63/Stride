import { describe, expect, it } from 'vitest';
import { STRIDE_PRODUCT_MODULES } from '@/lib/stride-module-map';

describe('stride-module-map', () => {
  it('defines eight product modules with unique ids', () => {
    const ids = STRIDE_PRODUCT_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('projects');
    expect(ids).toContain('hr-payroll');
  });

  it('projects is not licensed via HR core', () => {
    const projects = STRIDE_PRODUCT_MODULES.find((m) => m.id === 'projects');
    expect(projects?.switcherKeys).toEqual(['projects']);
    expect(projects?.subscriptionKeys).not.toContain('core');
  });
});
