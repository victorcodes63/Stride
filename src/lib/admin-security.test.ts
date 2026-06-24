import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { enforceSodCheck, SodViolationError } from '@/lib/admin-security';

const findFirstMock = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditEvent: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
  },
}));

describe('enforceSodCheck', () => {
  const oldDb = process.env.DATABASE_URL;

  beforeEach(() => {
    findFirstMock.mockReset();
    process.env.DATABASE_URL = 'postgres://test';
  });

  it('fails closed when database is unavailable', async () => {
    delete process.env.DATABASE_URL;
    await expect(
      enforceSodCheck({
        actorUserId: 'u1',
        entityType: 'Payroll',
        entityId: 'p1',
        forbiddenActions: ['payroll.updated'],
        actionLabel: 'payroll approve',
      }),
    ).rejects.toBeInstanceOf(SodViolationError);
  });

  it('blocks conflicting actor action', async () => {
    findFirstMock.mockResolvedValue({ action: 'payroll.updated' });
    await expect(
      enforceSodCheck({
        actorUserId: 'u1',
        entityType: 'Payroll',
        entityId: 'p1',
        forbiddenActions: ['payroll.updated'],
        actionLabel: 'payroll approve',
      }),
    ).rejects.toBeInstanceOf(SodViolationError);
  });

  it('passes when no prior conflict exists', async () => {
    findFirstMock.mockResolvedValue(null);
    await expect(
      enforceSodCheck({
        actorUserId: 'u1',
        entityType: 'Payroll',
        entityId: 'p1',
        forbiddenActions: ['payroll.updated'],
        actionLabel: 'payroll approve',
      }),
    ).resolves.toBeUndefined();
  });

  afterAll(() => {
    process.env.DATABASE_URL = oldDb;
  });
});
