import { describe, expect, it, vi, beforeEach } from 'vitest';

const executeRaw = vi.fn();
const transaction = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transaction(...args),
  },
}));

describe('withAuthPublicLookup', () => {
  beforeEach(() => {
    vi.resetModules();
    executeRaw.mockReset();
    transaction.mockReset();
  });

  it('sets sentinel org and auth_public_lookup before running callback', async () => {
    const tx = { $executeRaw: executeRaw };
    transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<string>) => fn(tx));
    executeRaw.mockResolvedValue(undefined);

    const { withAuthPublicLookup, AUTH_PUBLIC_LOOKUP_ORG_SENTINEL } = await import(
      '@/lib/auth/auth-public-lookup'
    );

    const result = await withAuthPublicLookup(async () => 'ok');

    expect(result).toBe('ok');
    expect(executeRaw).toHaveBeenCalledTimes(2);
    expect(executeRaw.mock.calls[0][1]).toBe(AUTH_PUBLIC_LOOKUP_ORG_SENTINEL);
  });
});
