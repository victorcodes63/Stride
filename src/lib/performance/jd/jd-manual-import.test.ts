import { describe, expect, it } from 'vitest';

import {
  JD_MANUAL_IMPORT_TEMPLATE,
  jdManualImportTemplateJson,
  parseJdManualJson,
} from '@/lib/performance/jd/jd-manual-import';

describe('jd-manual-import', () => {
  it('parses the bundled template', () => {
    const result = parseJdManualJson(jdManualImportTemplateJson());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manual.roles.length).toBe(JD_MANUAL_IMPORT_TEMPLATE.roles.length);
    expect(result.manual.divisions?.length).toBeGreaterThan(0);
  });

  it('rejects empty roles array', () => {
    const result = parseJdManualJson(JSON.stringify({ roles: [] }));
    expect(result.ok).toBe(false);
  });

  it('requires competency levels between 1 and 5', () => {
    const result = parseJdManualJson(
      JSON.stringify({
        roles: [
          {
            title: 'Test Role',
            competencies: [{ name: 'Bad', requiredLevel: 9 }],
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects invalid JSON', () => {
    expect(parseJdManualJson('{').ok).toBe(false);
  });
});
