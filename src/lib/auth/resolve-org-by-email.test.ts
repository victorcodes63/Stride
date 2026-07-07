import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/deployment-cell', () => ({
  isCustomerProductionCell: vi.fn(() => true),
}));

vi.mock('@/lib/auth/org-auth-config', () => ({
  ensureOrgAuthConfig: vi.fn(async (organizationId: string) => ({
    organizationId,
    staffEnabledProviders: ['credentials', 'microsoft'],
    essEnabledProviders: ['credentials'],
    ssoEnforcedStaff: false,
    ssoEnforcedEss: false,
    jitProvisioning: false,
    lockedMsTenantId: null,
    samlIdpMetadataUrl: null,
    samlEnabledStaff: false,
    samlEnabledEss: false,
  })),
  isProviderEnabledForAudience: vi.fn(() => true),
  isSsoEnforced: vi.fn(() => false),
  primaryAuthMethod: vi.fn(() => 'microsoft' as const),
  seedLegacyDomainsIfEmpty: vi.fn(),
}));

const DEFAULT_ORG = '00000000-0000-4000-8000-000000000001';
const CUSTOMER_ORG = '11111111-1111-4111-8111-111111111111';

const mockTx = {
  organizationEmailDomain: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  organizationMembership: {
    findMany: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  $executeRaw: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
  },
}));

vi.mock('@/lib/org-context', () => ({
  withOrgContext: vi.fn((_orgId: string, fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
}));

describe('resolveOrgByEmail domain disambiguation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('prefers a customer org over the legacy default org on production cells', async () => {
    mockTx.organizationEmailDomain.findMany.mockResolvedValue([
      { organizationId: CUSTOMER_ORG, createdAt: new Date('2026-06-01T00:00:00Z') },
      { organizationId: DEFAULT_ORG, createdAt: new Date('2025-01-01T00:00:00Z') },
    ]);
    mockTx.organization.findUnique.mockResolvedValue({
      id: CUSTOMER_ORG,
      name: 'Raven Tech Group',
      slug: 'raven-tech-group-ke',
    });
    mockTx.organizationEmailDomain.findFirst.mockResolvedValue({
      organizationId: CUSTOMER_ORG,
      domain: 'raventechgroup.com',
    });

    const { resolveOrgByEmail } = await import('@/lib/auth/resolve-org-by-email');
    const resolved = await resolveOrgByEmail('vchumo@raventechgroup.com', 'staff');

    expect(resolved?.organizationId).toBe(CUSTOMER_ORG);
    expect(resolved?.organizationSlug).toBe('raven-tech-group-ke');
  });

  it('prefers the org where the user already has membership when domains collide', async () => {
    mockTx.organizationEmailDomain.findMany.mockResolvedValue([
      { organizationId: DEFAULT_ORG, createdAt: new Date('2025-01-01T00:00:00Z') },
      { organizationId: CUSTOMER_ORG, createdAt: new Date('2026-06-01T00:00:00Z') },
    ]);
    mockTx.organizationMembership.findMany.mockResolvedValue([
      { organizationId: CUSTOMER_ORG },
    ]);
    mockTx.organization.findUnique.mockResolvedValue({
      id: CUSTOMER_ORG,
      name: 'Raven Tech Group',
      slug: 'raven-tech-group-ke',
    });
    mockTx.organizationEmailDomain.findFirst.mockResolvedValue({
      organizationId: CUSTOMER_ORG,
      domain: 'raventechgroup.com',
    });

    const { resolveOrgByEmail } = await import('@/lib/auth/resolve-org-by-email');
    const resolved = await resolveOrgByEmail('vchumo@raventechgroup.com', 'staff', {
      userId: 'user-1',
    });

    expect(resolved?.organizationId).toBe(CUSTOMER_ORG);
  });
});
