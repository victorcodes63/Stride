import { describe, expect, it } from 'vitest';

import { parseJobDescriptionDraft } from '@/lib/performance/parsing/registry';

describe('JD parser registry', () => {
  it('rejects manual mode parsing without sending data', async () => {
    const result = await parseJobDescriptionDraft(
      'manual',
      { fileName: 'role.txt', text: 'Job purpose\nLead the team' },
      { organizationId: 'org-1', aiConsented: false },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/manual/i);
  });

  it('rejects stride parsing without org consent', async () => {
    const result = await parseJobDescriptionDraft(
      'stride',
      { fileName: 'role.txt', text: 'Job purpose\nLead the team' },
      { organizationId: 'org-1', aiConsented: false },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/consent/i);
  });
});
