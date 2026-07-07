import { describe, expect, it } from 'vitest';
import { resolveOutsourcingClientId, withOutsourcingClientQuery } from '@/lib/outsourcing-client-context';

const clients = [
  { id: 'c1', name: 'Acme' },
  { id: 'c2', name: 'Beta' },
];

describe('outsourcing-client-context', () => {
  it('prefers URL client id when valid', () => {
    expect(resolveOutsourcingClientId(clients, 'c2')).toBe('c2');
  });

  it('falls back to first client', () => {
    expect(resolveOutsourcingClientId(clients, 'missing')).toBe('c1');
    expect(resolveOutsourcingClientId(clients, null)).toBe('c1');
  });

  it('builds links with clientId query', () => {
    expect(withOutsourcingClientQuery('/dashboard/outsourcing/employees', 'c2')).toBe(
      '/dashboard/outsourcing/employees?clientId=c2',
    );
    expect(withOutsourcingClientQuery('/dashboard/outsourcing/employees?status=active', 'c2')).toBe(
      '/dashboard/outsourcing/employees?status=active&clientId=c2',
    );
  });
});
