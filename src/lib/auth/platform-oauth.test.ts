import { describe, expect, it } from 'vitest';
import {
  STRIDE_MS_OAUTH_TENANT,
  getAuthJsProviderScaffold,
  getMicrosoftOAuthTokenEndpoint,
  isStrideGoogleOAuthConfigured,
  isStrideMicrosoftOAuthConfigured,
} from '@/lib/auth/platform-oauth';

describe('platform-oauth', () => {
  it('uses common tenant for multi-tenant Microsoft OAuth', () => {
    expect(STRIDE_MS_OAUTH_TENANT).toBe('common');
    expect(getMicrosoftOAuthTokenEndpoint()).toContain('/common/');
  });

  it('reads STRIDE_* env with legacy fallback', () => {
    const saved = {
      STRIDE_MS_CLIENT_ID: process.env.STRIDE_MS_CLIENT_ID,
      STRIDE_MS_CLIENT_SECRET: process.env.STRIDE_MS_CLIENT_SECRET,
      MS_CLIENT_ID: process.env.MS_CLIENT_ID,
      MS_CLIENT_SECRET: process.env.MS_CLIENT_SECRET,
    };
    delete process.env.STRIDE_MS_CLIENT_ID;
    delete process.env.STRIDE_MS_CLIENT_SECRET;
    process.env.MS_CLIENT_ID = 'legacy-id';
    process.env.MS_CLIENT_SECRET = 'legacy-secret';
    try {
      expect(isStrideMicrosoftOAuthConfigured()).toBe(true);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('exports Auth.js provider scaffold when configured', () => {
    const savedGoogle = {
      STRIDE_GOOGLE_CLIENT_ID: process.env.STRIDE_GOOGLE_CLIENT_ID,
      STRIDE_GOOGLE_CLIENT_SECRET: process.env.STRIDE_GOOGLE_CLIENT_SECRET,
    };
    process.env.STRIDE_GOOGLE_CLIENT_ID = 'g-id';
    process.env.STRIDE_GOOGLE_CLIENT_SECRET = 'g-secret';
    try {
      const scaffold = getAuthJsProviderScaffold();
      expect(scaffold.google?.clientId).toBe('g-id');
      expect(isStrideGoogleOAuthConfigured()).toBe(true);
    } finally {
      for (const [k, v] of Object.entries(savedGoogle)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
