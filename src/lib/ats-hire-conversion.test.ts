import { describe, expect, it } from 'vitest';
import { buildEmployeeFromHireConversion, validateHireProfileInput } from '@/lib/ats-hire-conversion';

describe('ats hire conversion', () => {
  it('builds employee payload using candidate and offer data', () => {
    const payload = buildEmployeeFromHireConversion({
      candidate: {
        firstName: 'Amina',
        lastName: 'Otieno',
        email: 'Amina@Example.com',
        phone: '+254700123456',
      },
      job: { title: 'HR Officer' },
      offer: {
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        proposedGrossSalary: 85000,
      },
      profile: {
        idNumber: '12345678',
        kraPin: 'A123456789K',
        nssfNumber: 'NSSF-100',
        nhifNumber: 'NHIF-200',
        departmentId: 'dept-1',
        costCenterCode: 'CC-OPS',
        clientId: 'client-1',
      },
    });

    expect(payload.email).toBe('amina@example.com');
    expect(payload.jobTitle).toBe('HR Officer');
    expect(payload.baseSalary).toBe(85000);
    expect(payload.departmentId).toBe('dept-1');
  });

  it('returns missing profile fields for invalid conversion request', () => {
    const missing = validateHireProfileInput({
      idNumber: '123',
      kraPin: '',
      nssfNumber: 'NSSF-1',
    });

    expect(missing).toContain('kraPin');
    expect(missing).toContain('departmentId');
    expect(missing).toContain('clientId');
  });
});
