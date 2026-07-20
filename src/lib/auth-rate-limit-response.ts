import { NextResponse } from 'next/server';
import {
  AUTH_RATE_LIMIT,
  authRateLimitKey,
  checkRateLimit,
} from '@/lib/rate-limit';

export function enforceAuthRateLimit(
  route: string,
  request: Request,
  options: { limit: number; windowMs: number } = AUTH_RATE_LIMIT,
): NextResponse | null {
  const key = authRateLimitKey(route, request);
  const result = checkRateLimit(key, options);
  if (result.allowed) return null;

  return NextResponse.json(
    { error: 'Too many attempts. Please wait and try again.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}
