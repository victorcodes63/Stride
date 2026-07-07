import { describe, expect, it } from 'vitest';
import {
  buildSupportOperatorDashboardUrl,
  mintSupportOperatorToken,
  verifySupportOperatorToken,
} from '@/lib/support-operator-session';

describe('support-operator-session', () => {
  it('mints and verifies operator tokens when provision key is set', () => {
    process.env.STRIDE_CELL_PROVISION_KEY = 'test-provision-key';
    const minted = mintSupportOperatorToken({
      organizationId: '00000000-0000-0000-0000-000000000001',
      operatorEmail: 'ops@raventech.group',
      operatorName: 'Ops User',
      customerSlug: 'acme-corp',
    });
    expect(minted).not.toBeNull();
    const verified = verifySupportOperatorToken(minted!.token);
    expect(verified?.operatorEmail).toBe('ops@raventech.group');
    expect(verified?.customerSlug).toBe('acme-corp');
    expect(buildSupportOperatorDashboardUrl('https://app.example.com', minted!.token)).toContain(
      'supportOperator=',
    );
    delete process.env.STRIDE_CELL_PROVISION_KEY;
  });
});
