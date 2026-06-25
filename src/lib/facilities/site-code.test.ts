import { describe, expect, it, vi } from 'vitest';
import { allocateSiteCode } from '@/lib/facilities/site-code';

describe('allocateSiteCode', () => {
  it('formats sequential site codes', async () => {
    const prisma = {
      facilitySite: {
        count: vi.fn().mockResolvedValue(2),
      },
    } as never;
    await expect(allocateSiteCode(prisma, 'client-1')).resolves.toBe('SITE-0003');
  });
});
