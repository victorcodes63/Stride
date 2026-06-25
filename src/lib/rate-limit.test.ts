import { describe, expect, it } from 'vitest';
import { checkRateLimit } from '@/lib/rate-limit';

describe('rate-limit', () => {
  it('allows requests within the window limit', () => {
    const key = `test-${Date.now()}`;
    const opts = { limit: 3, windowMs: 60_000 };
    expect(checkRateLimit(key, opts).allowed).toBe(true);
    expect(checkRateLimit(key, opts).allowed).toBe(true);
    expect(checkRateLimit(key, opts).allowed).toBe(true);
    expect(checkRateLimit(key, opts).allowed).toBe(false);
  });
});
