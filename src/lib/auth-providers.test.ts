import { describe, expect, it } from 'vitest';
import {
  getAuthProvidersSummary,
  isGoogleOAuthConfigured,
  isMicrosoftOAuthConfigured,
} from '@/lib/auth-providers';

describe('auth-providers', () => {
  it('returns microsoft and google in provider list', () => {
    const summary = getAuthProvidersSummary();
    expect(summary.providers).toHaveLength(2);
    expect(summary.providers.map((p) => p.key)).toEqual(['microsoft', 'google']);
  });

  it('reports not configured when env vars missing', () => {
    const msKeys = ['MS_CLIENT_ID', 'MS_CLIENT_SECRET'] as const;
    const googleKeys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const;
    const saved = Object.fromEntries(
      [...msKeys, ...googleKeys].map((k) => [k, process.env[k]]),
    );
    for (const k of [...msKeys, ...googleKeys]) delete process.env[k];
    try {
      expect(isMicrosoftOAuthConfigured()).toBe(false);
      expect(isGoogleOAuthConfigured()).toBe(false);
      expect(getAuthProvidersSummary().anyConfigured).toBe(false);
    } finally {
      for (const k of [...msKeys, ...googleKeys]) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  });
});
