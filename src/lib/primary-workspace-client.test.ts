import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

function buildRequest(entityId: 'ke' | 'ug'): Pick<NextRequest, 'headers' | 'cookies' | 'nextUrl'> {
  const headers = new Headers({ 'X-Entity-Id': entityId });
  return {
    headers,
    cookies: { get: () => undefined },
    nextUrl: new URL('https://example.com'),
  } as unknown as Pick<NextRequest, 'headers' | 'cookies' | 'nextUrl'>;
}

describe('resolvePrimaryWorkspaceClientId', () => {
  it('returns scoped client when request has entity and no requested client', async () => {
    const prisma = {
      outsourcingClient: {
        findFirst: vi.fn().mockResolvedValue({ id: 'client-ke' }),
      },
    } as unknown as Parameters<typeof resolvePrimaryWorkspaceClientId>[0];

    const result = await resolvePrimaryWorkspaceClientId(prisma, null, buildRequest('ke'));
    expect(result).toBe('client-ke');
  });

  it('throws when requested client is outside active entity scope', async () => {
    const prisma = {
      outsourcingClient: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'fallback-ug' }),
      },
    } as unknown as Parameters<typeof resolvePrimaryWorkspaceClientId>[0];

    await expect(
      resolvePrimaryWorkspaceClientId(prisma, 'client-ug', buildRequest('ke')),
    ).rejects.toThrow(/outside active entity scope/);
  });
});
