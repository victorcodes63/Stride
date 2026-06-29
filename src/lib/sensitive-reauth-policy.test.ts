import { describe, expect, it } from 'vitest';
import {
  sanitizeSensitiveReauthUserIds,
  userRequiresSensitiveReauth,
} from './sensitive-reauth-policy';

describe('sensitive-reauth-policy', () => {
  const policy = {
    sensitiveActionReauthEnabled: true,
    sensitiveActionReauthUserIds: [] as string[],
  };

  it('never requires re-auth for admins', () => {
    expect(userRequiresSensitiveReauth(policy, 'u1', 'admin')).toBe(false);
  });

  it('is off by default at org level', () => {
    expect(
      userRequiresSensitiveReauth(
        { sensitiveActionReauthEnabled: false, sensitiveActionReauthUserIds: [] },
        'u1',
        'staff',
      ),
    ).toBe(false);
  });

  it('applies to all non-admin staff when enabled with empty selection', () => {
    expect(userRequiresSensitiveReauth(policy, 'u1', 'staff')).toBe(true);
    expect(userRequiresSensitiveReauth(policy, 'u2', 'viewer')).toBe(true);
  });

  it('applies only to selected users when list is populated', () => {
    const selected = {
      sensitiveActionReauthEnabled: true,
      sensitiveActionReauthUserIds: ['u2'],
    };
    expect(userRequiresSensitiveReauth(selected, 'u1', 'staff')).toBe(false);
    expect(userRequiresSensitiveReauth(selected, 'u2', 'staff')).toBe(true);
  });

  it('sanitizes user id lists', () => {
    expect(sanitizeSensitiveReauthUserIds([' a ', 'b', '', 1, 'a'])).toEqual(['a', 'b']);
  });
});
