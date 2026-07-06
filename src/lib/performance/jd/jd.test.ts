import { describe, expect, it } from 'vitest';

import {
  STABEX_DIVISIONS,
  STABEX_ROLE_TEMPLATES,
  allStabexJobDescriptionInputs,
  buildStabexJobDescriptionInput,
} from '@/lib/performance/jd/stabex-reference';

describe('Stabex JD reference pack', () => {
  it('defines 13 divisions and 83 role templates', () => {
    expect(STABEX_DIVISIONS).toHaveLength(13);
    expect(STABEX_ROLE_TEMPLATES).toHaveLength(83);
  });

  it('builds structured JD inputs with KRAs, KPIs, and competencies', () => {
    const input = buildStabexJobDescriptionInput(STABEX_ROLE_TEMPLATES[0]);
    expect(input.kras?.length).toBeGreaterThanOrEqual(4);
    expect(input.competencies?.length).toBeGreaterThanOrEqual(4);
    expect(input.competencies?.every((c) => c.requiredLevel >= 1 && c.requiredLevel <= 5)).toBe(true);
  });

  it('generates one input per role template', () => {
    expect(allStabexJobDescriptionInputs()).toHaveLength(83);
  });
});
