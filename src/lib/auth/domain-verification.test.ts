import { describe, expect, it } from 'vitest';
import { formatDnsTxtRecord, normalizeDomainInput } from '@/lib/auth/domain-verification';

describe('domain-verification', () => {
  it('normalizes domain input', () => {
    expect(normalizeDomainInput(' @Acme.Co.Ke ')).toBe('acme.co.ke');
  });

  it('formats TXT record with stride prefix', () => {
    expect(formatDnsTxtRecord('abc123')).toBe('stride-domain-verification=abc123');
  });
});
