import { describe, expect, it } from 'vitest';
import {
  authProviderToPortalMethod,
  portalMethodToAuthProvider,
  primaryAuthMethod,
} from '@/lib/auth/org-auth-config';

describe('org-auth-config', () => {
  it('maps auth providers to portal methods', () => {
    expect(authProviderToPortalMethod('microsoft')).toBe('microsoft');
    expect(authProviderToPortalMethod('google')).toBe('google');
    expect(authProviderToPortalMethod('credentials')).toBe('credentials');
    expect(portalMethodToAuthProvider('microsoft')).toBe('microsoft');
  });

  it('picks primary method from provider list', () => {
    expect(primaryAuthMethod(['credentials'])).toBe('credentials');
    expect(primaryAuthMethod(['google', 'credentials'])).toBe('google');
    expect(primaryAuthMethod(['microsoft', 'google'])).toBe('microsoft');
  });
});
