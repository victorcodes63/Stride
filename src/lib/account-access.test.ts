import { describe, expect, it } from 'vitest';

import {
  getAccountStatusFromRequest,
  isLoginBlockedAccountStatus,
  shouldBypassAccountGate,
} from '@/lib/account-access';

describe('account-access', () => {
  it('blocks suspended and churned', () => {
    expect(isLoginBlockedAccountStatus('suspended')).toBe(true);
    expect(isLoginBlockedAccountStatus('churned')).toBe(true);
    expect(isLoginBlockedAccountStatus('active')).toBe(false);
  });

  it('allows bypass for configured emails', () => {
    const prev = process.env.RAVEN_ACCOUNT_BYPASS_EMAILS;
    process.env.RAVEN_ACCOUNT_BYPASS_EMAILS = 'ops@raventechgroup.com';
    try {
      expect(shouldBypassAccountGate('ops@raventechgroup.com')).toBe(true);
      expect(shouldBypassAccountGate('other@client.com')).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.RAVEN_ACCOUNT_BYPASS_EMAILS;
      else process.env.RAVEN_ACCOUNT_BYPASS_EMAILS = prev;
    }
  });

  it('returns null status without entitlements cookie', () => {
    const req = { cookies: { get: () => undefined } } as never;
    expect(getAccountStatusFromRequest(req)).toBeNull();
  });
});
