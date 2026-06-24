import { NextRequest, NextResponse } from 'next/server';
import { createEssOAuthStartResponse } from '@/lib/oauth/ess-oauth-handlers';
import { assertOAuthProviderEnabled } from '@/lib/oauth/assert-oauth-enabled';

export async function GET(request: NextRequest) {
  const disabled = await assertOAuthProviderEnabled(request, 'ess', 'google');
  if (disabled) return disabled;
  return createEssOAuthStartResponse(request, 'google');
}
