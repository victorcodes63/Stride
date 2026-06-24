import { describe, expect, it } from 'vitest';
import { createAuthChallengeToken, verifyAuthChallengeToken } from '@/lib/auth-challenge';
import { generateTotpSecret, verifyTotpCode } from '@/lib/mfa-totp';

describe('mfa totp + challenge', () => {
  it('verifies RFC6238 sample code', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(verifyTotpCode(secret, '287082', 59, 0)).toBe(true);
  });

  it('rejects invalid TOTP code', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, '000000', Math.floor(Date.now() / 1000), 1)).toBe(false);
  });

  it('round-trips signed MFA challenge token', () => {
    const token = createAuthChallengeToken({
      userId: 'u_123',
      email: 'finance@example.com',
      purpose: 'login_mfa',
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const payload = verifyAuthChallengeToken(token, 'login_mfa');
    expect(payload?.userId).toBe('u_123');
    expect(payload?.email).toBe('finance@example.com');
  });
});
