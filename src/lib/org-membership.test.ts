import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ORGANIZATION_ID,
  NoOrgMembershipForLoginError,
} from '@/lib/org-membership';

vi.mock('@/lib/auth/resolve-org-by-email', () => ({
  resolveOrgByEmail: vi.fn(),
}));

vi.mock('@/lib/deployment-cell', () => ({
  isDemoSandboxCell: vi.fn(),
}));

vi.mock('@/lib/org-context', () => ({
  withOrgContext: vi.fn((_orgId: string, fn: (tx: typeof mockDb) => unknown) => fn(mockDb)),
}));

const { resolveOrgByEmail } = await import('@/lib/auth/resolve-org-by-email');
const { isDemoSandboxCell } = await import('@/lib/deployment-cell');

const mockDb = {
  organizationMembership: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  $executeRaw: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: typeof mockDb) => unknown) => fn(mockDb)),
  },
}));

const { membershipForLogin } = await import('@/lib/org-membership');

describe('membershipForLogin ISO-02', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.DEMO_PACK;
  });

  it('throws when verified-domain user has no membership on customer cell', async () => {
    vi.mocked(isDemoSandboxCell).mockReturnValue(false);
    vi.mocked(resolveOrgByEmail).mockResolvedValue({
      organizationId: 'org-raven',
      verifiedDomain: true,
      credentialsAllowed: true,
    } as Awaited<ReturnType<typeof resolveOrgByEmail>>);
    mockDb.organizationMembership.findMany.mockResolvedValue([]);

    await expect(
      membershipForLogin('user-1', 'admin', null, 'admin@raventechgroup.com'),
    ).rejects.toBeInstanceOf(NoOrgMembershipForLoginError);
  });

  it('auto-attaches default org only on demo sandbox cell', async () => {
    vi.mocked(isDemoSandboxCell).mockReturnValue(true);
    vi.mocked(resolveOrgByEmail).mockResolvedValue(null);
    mockDb.organizationMembership.findMany.mockResolvedValue([]);
    mockDb.organizationMembership.upsert.mockResolvedValue({
      id: 'm1',
      organizationId: DEFAULT_ORGANIZATION_ID,
      role: 'admin',
      organization: { id: DEFAULT_ORGANIZATION_ID, name: 'Default', slug: 'default' },
    });

    const result = await membershipForLogin('user-1', 'admin', null, 'demo@example.com');
    expect(result.organizationId).toBe(DEFAULT_ORGANIZATION_ID);
    expect(mockDb.organizationMembership.upsert).toHaveBeenCalled();
  });
});
