import { describe, expect, it } from 'vitest';
import {
  buildEmployeeFromHireConversion,
  resolveHireOutsourcingClientId,
  validateHireProfileInput,
} from '@/lib/ats-hire-conversion';

describe('ats hire conversion', () => {
  it('builds employee payload using candidate and offer data', () => {
    const payload = buildEmployeeFromHireConversion({
      candidate: {
        firstName: 'Amina',
        lastName: 'Otieno',
        email: 'Amina@Example.com',
        phone: '+254700123456',
      },
      job: { title: 'HR Officer', outsourcingClientId: 'client-1' },
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
        outsourcingClientId: 'client-1',
      },
    });

    expect(payload.email).toBe('amina@example.com');
    expect(payload.jobTitle).toBe('HR Officer');
    expect(payload.baseSalary).toBe(85000);
    expect(payload.departmentId).toBe('dept-1');
    expect(payload.outsourcingClientId).toBe('client-1');
  });

  it('resolves outsourcing client from job when profile omits it', () => {
    const resolved = resolveHireOutsourcingClientId({
      job: { title: 'Driver', outsourcingClientId: 'client-rpo' },
      profile: { departmentId: 'dept-1' },
    });
    expect(resolved).toBe('client-rpo');
  });

  it('throws when job and profile end-client disagree', () => {
    expect(() =>
      resolveHireOutsourcingClientId({
        job: { title: 'Driver', outsourcingClientId: 'client-a' },
        profile: { outsourcingClientId: 'client-b' },
      }),
    ).toThrow('RPO_CLIENT_MISMATCH');
  });

  it('returns missing profile fields for invalid conversion request', () => {
    const missing = validateHireProfileInput({
      idNumber: '123',
      kraPin: '',
      nssfNumber: 'NSSF-1',
    });

    expect(missing).toContain('kraPin');
    expect(missing).toContain('departmentId');
    expect(missing).not.toContain('outsourcingClientId');
  });

  it('requires outsourcing client when RPO hire flag is set', () => {
    const missing = validateHireProfileInput(
      {
        idNumber: '12345678',
        kraPin: 'A123456789K',
        nssfNumber: 'NSSF-100',
        nhifNumber: 'NHIF-200',
        departmentId: 'dept-1',
        costCenterCode: 'CC-OPS',
      },
      { requireOutsourcingClient: true },
    );
    expect(missing).toContain('outsourcingClientId');
  });
});
