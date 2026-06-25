import { describe, expect, it, vi } from 'vitest';
import { allocateProjectCode } from '@/lib/projects/project-code';

describe('allocateProjectCode', () => {
  it('formats sequential codes per client', async () => {
    const prisma = {
      project: {
        count: vi.fn().mockResolvedValue(3),
      },
    } as never;

    await expect(allocateProjectCode(prisma, 'client-1')).resolves.toBe('PRJ-0004');
    expect(prisma.project.count).toHaveBeenCalledWith({ where: { outsourcingClientId: 'client-1' } });
  });

  it('starts at PRJ-0001 for empty client', async () => {
    const prisma = {
      project: {
        count: vi.fn().mockResolvedValue(0),
      },
    } as never;

    await expect(allocateProjectCode(prisma, 'client-2')).resolves.toBe('PRJ-0001');
  });
});
