import { NextRequest, NextResponse } from 'next/server';
import { createEssOAuthStartResponse } from '@/lib/oauth/ess-oauth-handlers';
import { assertOAuthProviderEnabled } from '@/lib/oauth/assert-oauth-enabled';

export async function GET(request: NextRequest) {
  const disabled = await assertOAuthProviderEnabled(request, 'ess', 'microsoft');
  if (disabled) return disabled;
  return createEssOAuthStartResponse(request, 'microsoft');
}
