import { NextRequest } from 'next/server';
import { completeEssOAuthCallback } from '@/lib/oauth/ess-oauth-handlers';

export async function GET(request: NextRequest) {
  return completeEssOAuthCallback(request, 'google');
}
