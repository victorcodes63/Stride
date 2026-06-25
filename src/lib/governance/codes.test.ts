import { describe, expect, it, vi } from 'vitest';
import { allocateMeetingCode, allocateResolutionCode } from '@/lib/governance/codes';

describe('governance codes', () => {
  it('allocates meeting codes', async () => {
    const prisma = {
      governanceMeeting: { count: vi.fn().mockResolvedValue(0) },
    } as never;
    await expect(allocateMeetingCode(prisma, 'c1')).resolves.toBe('MTG-0001');
  });

  it('allocates resolution codes', async () => {
    const prisma = {
      governanceResolution: { count: vi.fn().mockResolvedValue(4) },
    } as never;
    await expect(allocateResolutionCode(prisma, 'c1')).resolves.toBe('RES-0005');
  });
});
