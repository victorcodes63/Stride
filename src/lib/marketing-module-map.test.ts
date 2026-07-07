import { describe, expect, it } from 'vitest';
import { MODULE_KEYS } from '@/lib/module-registry';
import {
  INDUSTRY_PACK_MODULE_KEYS,
  MARKETING_AREA_MODULE_KEYS,
  MARKETING_MODULE_READINESS,
  MARKETING_PRODUCT_AREAS,
  validateMarketingModuleCoverage,
} from '@/lib/marketing-module-map';

describe('marketing-module-map', () => {
  it('covers every ModuleKey without duplication', () => {
    expect(() => validateMarketingModuleCoverage()).not.toThrow();
    const areaKeys = Object.values(MARKETING_AREA_MODULE_KEYS).flat();
    const industryOnly = INDUSTRY_PACK_MODULE_KEYS.filter(
      (key) => !areaKeys.includes(key),
    );
    const mapped = new Set([...areaKeys, ...industryOnly]);
    expect(mapped.size).toBe(MODULE_KEYS.length);
    for (const key of MODULE_KEYS) {
      expect(mapped.has(key)).toBe(true);
    }
  });

  it('exposes nine product areas with module chips', () => {
    expect(MARKETING_PRODUCT_AREAS).toHaveLength(9);
    for (const area of MARKETING_PRODUCT_AREAS) {
      expect(area.modules.length).toBeGreaterThan(0);
      expect(['live', 'partial', 'roadmap']).toContain(area.readiness);
    }
  });

  it('keeps Sales, Outsourcing, Recruitment and Performance visible in their areas', () => {
    const hr = MARKETING_PRODUCT_AREAS.find((a) => a.id === 'hr-payroll');
    const outsourcing = MARKETING_PRODUCT_AREAS.find((a) => a.id === 'hr-outsourcing');
    const sales = MARKETING_PRODUCT_AREAS.find((a) => a.id === 'sales');
    expect(hr?.modules.map((m) => m.key)).toEqual(
      expect.arrayContaining(['ats', 'performance']),
    );
    expect(outsourcing?.modules.map((m) => m.key)).toEqual(['outsourcing']);
    expect(sales?.modules.map((m) => m.key)).toEqual(['sales']);
  });

  it('assigns honest readiness to every module', () => {
    for (const key of MODULE_KEYS) {
      expect(MARKETING_MODULE_READINESS[key]).toBeDefined();
    }
    expect(MARKETING_MODULE_READINESS.fleet).toBe('live');
    expect(MARKETING_MODULE_READINESS.sacco).toBe('roadmap');
    expect(MARKETING_MODULE_READINESS.sales).toBe('partial');
  });
});
