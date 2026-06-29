import { NextResponse } from 'next/server';
import type { DeploymentTier } from '@/lib/deployment-tier';

/** API guard — company setup is not tier-gated (reserved for future enterprise fork flag). */
export function companySetupAccessDeniedResponse(_tier?: DeploymentTier): NextResponse | null {
  return null;
}
