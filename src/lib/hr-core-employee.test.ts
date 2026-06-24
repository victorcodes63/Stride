import { describe, expect, it } from 'vitest';
import {
  assertEmployeeProfileCompleteness,
  getProfileCompleteness,
  normalizeEmployeeSearchPreset,
} from '@/lib/hr-core-employee';

describe('hr-core-employee', () => {
  it('returns missing profile fields for incomplete records', () => {
    const result = getProfileCompleteness({
      firstName: 'Amina',
      lastName: 'Otieno',
      jobTitle: 'Officer',
    });

    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toContain('idNumber');
    expect(result.missingFields).toContain('costCenterCode');
  });

  it('accepts complete employee profiles', () => {
    expect(() =>
      assertEmployeeProfileCompleteness({
        firstName: 'Amina',
        lastName: 'Otieno',
        idNumber: '12345678',
        kraPin: 'A123456789K',
        nssfNumber: 'NSSF-7788',
        nhifNumber: 'NHIF-9988',
        dateOfJoining: new Date('2024-01-10'),
        jobTitle: 'HR Officer',
        departmentId: 'dept-1',
        costCenterCode: 'CC-OPS-01',
      })
    ).not.toThrow();
  });

  it('normalizes invalid presets to all', () => {
    expect(normalizeEmployeeSearchPreset('unknown')).toBe('all');
    expect(normalizeEmployeeSearchPreset('without_manager')).toBe('without_manager');
  });
});
