import { describe, expect, it } from 'vitest';
import { buildObligationRegister } from '@/lib/legal/obligations';

describe('buildObligationRegister', () => {
  const asOf = new Date('2026-07-17T12:00:00Z');

  it('merges contracts, credentials, policies, and compliance rows sorted by due date', () => {
    const rows = buildObligationRegister({
      asOf,
      contracts: [
        {
          id: 'c1',
          title: 'Office lease',
          reference: 'LEASE-001',
          endDate: new Date('2026-09-01'),
          managers: [{ name: 'Jane Doe' }],
        },
      ],
      credentials: [
        {
          id: 'cr1',
          credentialName: 'Practising licence',
          expiryDate: new Date('2026-06-01'),
          employee: { firstName: 'John', lastName: 'Smith' },
        },
      ],
      policies: [
        {
          id: 'p1',
          title: 'Data protection policy',
          category: 'Policy',
          expiryDate: new Date('2026-08-15'),
        },
      ],
      compliance: [
        {
          id: 'o1',
          title: 'Annual board filing',
          category: 'filing',
          dueDate: new Date('2026-07-01'),
          status: 'pending',
          regulator: 'Registrar of Companies',
          owner: { name: 'Legal team' },
        },
      ],
    });

    expect(rows).toHaveLength(4);
    expect(rows[0]?.source).toBe('credential');
    expect(rows[0]?.status).toBe('overdue');
    expect(rows[1]?.source).toBe('compliance');
    expect(rows[2]?.source).toBe('policy');
    expect(rows[3]?.source).toBe('contract');
    expect(rows[3]?.href).toBe('/dashboard/people/contracts/c1');
    expect(rows[3]?.owner).toBe('Jane Doe');
  });

  it('marks completed and waived compliance obligations without due-soon bucketing', () => {
    const rows = buildObligationRegister({
      asOf,
      contracts: [],
      credentials: [],
      compliance: [
        {
          id: 'o1',
          title: 'Filed return',
          category: 'filing',
          dueDate: new Date('2026-01-01'),
          status: 'completed',
          regulator: null,
          owner: null,
        },
        {
          id: 'o2',
          title: 'Optional permit',
          category: 'permit',
          dueDate: new Date('2026-01-01'),
          status: 'waived',
          regulator: null,
          owner: null,
        },
      ],
    });

    expect(rows.map((r) => r.status)).toEqual(['completed', 'waived']);
  });

  it('skips credentials without expiry dates', () => {
    const rows = buildObligationRegister({
      asOf,
      contracts: [],
      credentials: [
        {
          id: 'cr1',
          credentialName: 'Permanent ID',
          expiryDate: null,
          employee: { firstName: 'A', lastName: 'B' },
        },
      ],
    });

    expect(rows).toHaveLength(0);
  });
});
